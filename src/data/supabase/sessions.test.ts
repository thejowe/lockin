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
  toMatchStreak,
  toSessionAttendance,
  toSessionError,
  toSessionRatingEntry,
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

describe('toLockInSession / toSessionAttendance / toSessionRatingEntry / toMatchStreak', () => {
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
    ).toEqual({
      sessionId: 's',
      profileId: 'p',
      joinedAt: '2026-09-14T18:00:00.000Z',
      leftAt: null,
    });
  });

  it('traduce la valoración y normaliza rated_at', () => {
    expect(
      toSessionRatingEntry({
        session_id: 'session-1',
        profile_id: 'user-a',
        rating: 'genial',
        rated_at: '2026-09-15T12:00:00+00:00',
      })
    ).toEqual({
      sessionId: 'session-1',
      profileId: 'user-a',
      rating: 'genial',
      ratedAt: '2026-09-15T12:00:00.000Z',
    });
  });

  it('traduce la racha y normaliza alive_until', () => {
    expect(
      toMatchStreak({
        match_id: 'match-1',
        streak_count: 4,
        alive_until: '2026-09-22T18:00:00+00:00',
      })
    ).toEqual({ matchId: 'match-1', count: 4, aliveUntil: '2026-09-22T18:00:00.000Z' });
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

  it('getActive pide la sesión viva por RPC, sin decidir "viva" con el reloj del cliente', async () => {
    const { client, repository } = fakeClient({
      rpc: { active_session: { data: [row({ id: 'live' })], error: null } },
    });

    const session = await repository.getActive('match-1');

    expect(client.rpc).toHaveBeenCalledWith('active_session', { p_match_id: 'match-1' });
    expect(session?.id).toBe('live');
  });

  it('getActive devuelve null cuando el RPC no trae ninguna fila viva', async () => {
    const { repository } = fakeClient({ rpc: { active_session: { data: [], error: null } } });

    expect(await repository.getActive('match-1')).toBeNull();
  });

  it('join avisa al match de la sesión aunque no se haya leído antes', async () => {
    const { repository } = fakeClient({
      select: { data: row(), error: null },
      rpc: {
        join_session: {
          data: {
            session_id: 'session-1',
            profile_id: 'user-a',
            joined_at: row().created_at,
            left_at: null,
          },
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

  it('getRatable devuelve la única fila del RPC', async () => {
    const ratable = row({ id: 'ratable', status: 'aceptada' });
    const { client, repository } = fakeClient({
      rpc: { ratable_session: { data: [ratable], error: null } },
    });

    const session = await repository.getRatable('match-1');

    expect(client.rpc).toHaveBeenCalledWith('ratable_session', { p_match_id: 'match-1' });
    expect(session?.id).toBe('ratable');
  });

  it('getRatable da null cuando el RPC no devuelve ninguna fila', async () => {
    const { repository } = fakeClient({ rpc: { ratable_session: { data: [], error: null } } });

    await expect(repository.getRatable('match-1')).resolves.toBeNull();
  });

  it('getMyRating lee la tabla por session_id y deja el resto a la RLS', async () => {
    const { client, chain, repository } = fakeClient({
      select: { data: { rating: 'genial' }, error: null },
    });

    await expect(repository.getMyRating('session-1')).resolves.toBe('genial');

    expect(client.from).toHaveBeenCalledWith('session_ratings');
    expect(chain).toContain('eq(["session_id","session-1"])');
    // Sin filtro por `profile_id` a propósito: lo pone la política
    // `profile_id = auth.uid()`. Si se relajara, este select devolvería la
    // valoración de la otra persona y el caso de privacidad de la suite de
    // contrato lo cazaría — un `where` del cliente lo taparía.
    expect(chain.join(' ')).not.toContain('profile_id');
  });

  it('getMyRating da null cuando no hay fila propia', async () => {
    const { repository } = fakeClient();

    await expect(repository.getMyRating('session-1')).resolves.toBeNull();
  });

  it('rate llama al RPC con sus argumentos y mapea la fila', async () => {
    const { client, repository } = fakeClient({
      rpc: {
        rate_session: {
          data: {
            session_id: 'session-1',
            profile_id: 'user-a',
            rating: 'genial',
            rated_at: '2026-09-15T12:00:00+00:00',
          },
          error: null,
        },
      },
    });

    const entry = await repository.rate('session-1', 'genial');

    expect(client.rpc).toHaveBeenCalledWith('rate_session', {
      p_session_id: 'session-1',
      p_rating: 'genial',
    });
    expect(entry).toEqual({
      sessionId: 'session-1',
      profileId: 'user-a',
      rating: 'genial',
      ratedAt: '2026-09-15T12:00:00.000Z',
    });
  });

  it.each([
    ['LI001', SessionConflictError],
    ['LI003', SessionWindowError],
    ['LI004', SessionForbiddenError],
  ])('rate traduce %s a su error de dominio', async (code, ErrorClass) => {
    const { repository } = fakeClient({
      rpc: { rate_session: { data: null, error: { code, message: 'detalle' } } },
    });

    await expect(repository.rate('session-1', 'bien')).rejects.toBeInstanceOf(ErrorClass);
  });

  it('rate no avisa a los suscriptores del match, al contrario que join', async () => {
    const { repository } = fakeClient({
      select: { data: row(), error: null },
      rpc: {
        rate_session: {
          data: {
            session_id: 'session-1',
            profile_id: 'user-a',
            rating: 'genial',
            rated_at: '2026-09-15T12:00:00+00:00',
          },
          error: null,
        },
        join_session: {
          data: {
            session_id: 'session-1',
            profile_id: 'user-a',
            joined_at: row().created_at,
            left_at: null,
          },
          error: null,
        },
      },
    });
    const listener = jest.fn();
    repository.subscribe('match-1', listener);

    await repository.rate('session-1', 'genial');

    // La valoración es privada: avisar publicaría por el canal del match que
    // alguien acaba de valorar.
    expect(listener).not.toHaveBeenCalled();

    // El contraste con `join`, que sí avisa, es lo que prueba que el silencio
    // de arriba es la decisión de privacidad y no un doble que no notifica.
    await repository.join('session-1');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('listStreaks mapea las filas del RPC sin filtrar ni tocar session_ratings', async () => {
    const { client, repository } = fakeClient({
      rpc: {
        match_streaks: {
          data: [
            { match_id: 'match-1', streak_count: 3, alive_until: '2026-09-22T18:00:00+00:00' },
          ],
          error: null,
        },
      },
    });

    const streaks = await repository.listStreaks();

    expect(client.rpc).toHaveBeenCalledWith('match_streaks');
    expect(client.from).not.toHaveBeenCalledWith('session_ratings');
    expect(streaks).toEqual([
      { matchId: 'match-1', count: 3, aliveUntil: '2026-09-22T18:00:00.000Z' },
    ]);
  });

  it('listStreaks da un array vacío cuando ningún match tiene racha viva', async () => {
    const { repository } = fakeClient({ rpc: { match_streaks: { data: [], error: null } } });

    await expect(repository.listStreaks()).resolves.toEqual([]);
  });

  it('un error del RPC de rachas se propaga', async () => {
    const { repository } = fakeClient({
      rpc: { match_streaks: { data: null, error: { message: 'boom' } } },
    });

    await expect(repository.listStreaks()).rejects.toEqual({ message: 'boom' });
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
