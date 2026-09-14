/**
 * Mapeo, traducción de errores y orquestación del repositorio de sesiones de
 * Supabase, sin red: el cliente es un doble que registra las llamadas.
 *
 * El comportamiento contra Postgres real lo prueba la suite de contrato opt-in
 * (`contract.test.ts`); esto fija lo que esa suite no ve en `npm test`.
 */

import {
  SessionConflictError,
  SessionExpiredError,
  SessionForbiddenError,
  SessionWindowError,
} from '../session-errors';
import {
  createSupabaseSessionRepository,
  toLockInSession,
  toSessionAttendance,
  toSessionError,
} from './sessions';

import type { LockInSupabaseClient } from './client';
import type { SessionRow } from './database.types';

type Result = { data: unknown; error: { code?: string; message: string } | null };

/** Doble mínimo del cliente: `from()` encadenable y awaitable, `rpc()` y canales. */
function fakeClient(responses: { select?: Result; rpc?: Record<string, Result> } = {}) {
  const chain: string[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'order', 'limit']) {
    builder[method] = (...args: unknown[]) => {
      chain.push(`${method}(${JSON.stringify(args)})`);
      return builder;
    };
  }
  builder.maybeSingle = () => Promise.resolve(responses.select ?? { data: null, error: null });
  builder.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(responses.select ?? { data: [], error: null }).then(resolve, reject);

  const channel = { on: jest.fn(), subscribe: jest.fn() };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);

  const client = {
    from: jest.fn(() => builder),
    rpc: jest.fn(async (fn: string) => responses.rpc?.[fn] ?? { data: null, error: null }),
    channel: jest.fn(() => channel),
    removeChannel: jest.fn(async () => 'ok'),
  };

  const repository = createSupabaseSessionRepository({
    getClient: () => client as unknown as LockInSupabaseClient,
    getUserId: async () => 'user-a',
  });
  return { client, channel, chain, repository };
}

const MINUTE = 60_000;

function row(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 'session-1',
    match_id: 'match-1',
    proposed_by: 'user-a',
    starts_at: new Date(Date.now() + 60 * MINUTE).toISOString().replace('Z', '+00:00'),
    blocks: 2,
    status: 'propuesta',
    created_at: '2026-09-13T10:00:00+00:00',
    responded_at: null,
    ...overrides,
  };
}

describe('toLockInSession / toSessionAttendance', () => {
  it('traduce columnas y normaliza las fechas a ISO con Z', () => {
    const session = toLockInSession(row({ starts_at: '2026-09-14T18:00:00+00:00' }));

    expect(session).toEqual({
      id: 'session-1',
      matchId: 'match-1',
      proposedBy: 'user-a',
      startsAt: '2026-09-14T18:00:00.000Z',
      blocks: 2,
      status: 'propuesta',
      createdAt: '2026-09-13T10:00:00.000Z',
      respondedAt: null,
    });
  });

  it('conserva un left_at nulo como null', () => {
    expect(
      toSessionAttendance({
        session_id: 's',
        profile_id: 'p',
        joined_at: '2026-09-14T18:00:00+00:00',
        left_at: null,
      })
    ).toEqual({ sessionId: 's', profileId: 'p', joinedAt: '2026-09-14T18:00:00.000Z', leftAt: null });
  });
});

describe('toSessionError', () => {
  it.each([
    ['LI001', SessionConflictError],
    ['LI002', SessionExpiredError],
    ['LI003', SessionWindowError],
    ['LI004', SessionForbiddenError],
  ])('%s se traduce a su error de dominio', (code, ErrorClass) => {
    const translated = toSessionError({ code, message: 'detalle' });
    expect(translated).toBeInstanceOf(ErrorClass);
    expect((translated as Error).message).toBe('detalle');
  });

  it('cualquier otro código sale tal cual, sin disfrazarlo', () => {
    const original = { code: '28000', message: 'sin sesión' };
    expect(toSessionError(original)).toBe(original);
  });
});

describe('createSupabaseSessionRepository', () => {
  it('propose llama al RPC con sus argumentos y avisa a los suscriptores del match', async () => {
    const { client, repository } = fakeClient({
      rpc: { propose_session: { data: row(), error: null } },
    });
    const listener = jest.fn();
    repository.subscribe('match-1', listener);

    const session = await repository.propose({
      matchId: 'match-1',
      startsAt: '2026-09-14T18:00:00.000Z',
      blocks: 2,
    });

    expect(client.rpc).toHaveBeenCalledWith('propose_session', {
      p_match_id: 'match-1',
      p_starts_at: '2026-09-14T18:00:00.000Z',
      p_blocks: 2,
    });
    expect(session.status).toBe('propuesta');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('un error LI00x del RPC llega como error de dominio', async () => {
    const { repository } = fakeClient({
      rpc: { respond_session: { data: null, error: { code: 'LI001', message: 'ya' } } },
    });

    await expect(repository.respond('session-1', 'aceptada')).rejects.toBeInstanceOf(
      SessionConflictError
    );
  });

  it('getActive descarta lo que ya no está vivo y pide solo estados vivos', async () => {
    const expired = row({ id: 'old', starts_at: new Date(Date.now() - MINUTE).toISOString() });
    const live = row({ id: 'live' });
    const { chain, repository } = fakeClient({ select: { data: [expired, live], error: null } });

    const session = await repository.getActive('match-1');

    expect(session?.id).toBe('live');
    expect(chain).toContain('in(["status",["propuesta","aceptada"]])');
  });

  it('join avisa al match de la sesión aunque no se haya leído antes', async () => {
    const { repository } = fakeClient({
      select: { data: row(), error: null },
      rpc: {
        join_session: {
          data: { session_id: 'session-1', profile_id: 'user-a', joined_at: row().created_at, left_at: null },
          error: null,
        },
      },
    });
    const listener = jest.fn();
    repository.subscribe('match-1', listener);

    await repository.join('session-1');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('serverNow devuelve la hora del servidor en ISO', async () => {
    const { repository } = fakeClient({
      rpc: { server_now: { data: '2026-09-13T12:00:00.123+00:00', error: null } },
    });

    await expect(repository.serverNow()).resolves.toBe('2026-09-13T12:00:00.123Z');
  });

  it('abre un canal por match y lo cierra con el último suscriptor', async () => {
    const { client, repository } = fakeClient();

    const first = repository.subscribe('match-1', jest.fn());
    const second = repository.subscribe('match-1', jest.fn());
    expect(client.channel).toHaveBeenCalledTimes(1);

    first();
    expect(client.removeChannel).not.toHaveBeenCalled();
    second();
    expect(client.removeChannel).toHaveBeenCalledTimes(1);
  });
});
