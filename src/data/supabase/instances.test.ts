/**
 * Aislamiento entre juegos de repositorios de Supabase.
 *
 * Los avisos, los canales de realtime y las marcas de escritura propia vivían
 * en variables de módulo: dos `createSupabaseRepositories()` del mismo proceso
 * compartían las tres cosas, así que un test no podía aislar dos instancias y
 * una ráfaga de escrituras podía desalojar la marca de una fila cuyo eco aún
 * venía de camino (el `Set` tenía techo de 256 y tiraba la más antigua).
 *
 * Aquí se fija lo contrario: cada instancia tiene lo suyo, y la marca solo
 * caduca por tiempo.
 */

import { buildProfile } from '@/data/test-fixtures';

import { adoptLinkedGithubIdentity, linkGithubIdentity } from './auth';
import { createSupabaseRepositories } from './index';
import { getSupabaseClient } from './client';

import type { LockInSupabaseClient } from './client';
import type { MatchRow } from './database.types';

jest.mock('./client', () => ({
  getSupabaseClient: jest.fn(),
  hasSupabaseCredentials: true,
}));

jest.mock('./auth', () => ({
  ensureUserId: jest.fn(async () => 'user-a'),
  adoptLinkedGithubIdentity: jest.fn(async () => false),
  linkGithubIdentity: jest.fn(),
  unlinkGithubIdentity: jest.fn(),
  AccountError: class extends Error {},
  completeAuthLink: jest.fn(),
  currentUserId: jest.fn(),
  getAccountState: jest.fn(),
  linkEmailToCurrentUser: jest.fn(),
  sendPasswordReset: jest.fn(),
  setAccountPassword: jest.fn(),
  signInWithEmail: jest.fn(),
  signOut: jest.fn(),
  signUpWithEmail: jest.fn(),
}));

/** Handler de `postgres_changes` registrado por un canal. */
type Handler = (payload: { new?: Partial<MatchRow> }) => void;

interface FakeChannel {
  name: string;
  handlers: Handler[];
  /** El segundo argumento de cada `on()`: evento, esquema, tabla y filtro. */
  filters: unknown[];
}

function matchRow(id: string): MatchRow {
  return {
    id,
    profile_a: 'user-a',
    profile_b: 'user-b',
    mode: 'par',
    created_at: '2026-09-17T10:00:00+00:00',
    last_message_at: null,
  };
}

/** Cliente doble: solo lo que usan `channel()` y el RPC `record_decision`. */
function fakeClient(decision: MatchRow | null = null) {
  const channels: FakeChannel[] = [];

  const client = {
    channel: jest.fn((name: string) => {
      const channel: FakeChannel = { name, handlers: [], filters: [] };
      channels.push(channel);
      const api = {
        on: (_event: string, filter: unknown, handler: Handler) => {
          channel.handlers.push(handler);
          channel.filters.push(filter);
          return api;
        },
        subscribe: () => api,
      };
      return api;
    }),
    removeChannel: jest.fn(async () => 'ok'),
    rpc: jest.fn(async () => ({ data: decision, error: null })),
  };

  return { client: client as unknown as LockInSupabaseClient, channels };
}

const asMock = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

afterEach(() => {
  jest.clearAllMocks();
});

describe('dos juegos de repositorios de Supabase', () => {
  it('el canal de matches escucha INSERT y UPDATE, nunca DELETE', () => {
    const { client, channels } = fakeClient();
    asMock.mockReturnValue(client);

    createSupabaseRepositories().matches.subscribe(jest.fn());

    // Ni '*' ni DELETE: Realtime entrega los DELETE sin RLS a cualquier
    // suscriptor de la tabla, también el de un match ajeno.
    expect(channels[0].filters).toEqual([
      { event: 'INSERT', schema: 'public', table: 'matches' },
      { event: 'UPDATE', schema: 'public', table: 'matches' },
      { event: 'INSERT', schema: 'public', table: 'messages' },
    ]);
  });

  it('no comparten ni listeners ni canales de realtime', () => {
    const { client, channels } = fakeClient();
    asMock.mockReturnValue(client);

    const uno = createSupabaseRepositories();
    const otro = createSupabaseRepositories();

    const enUno = jest.fn();
    const enOtro = jest.fn();
    const salirDeUno = uno.matches.subscribe(enUno);
    otro.matches.subscribe(enOtro);

    // Antes, el segundo se enganchaba al canal del primero: un solo `channel()`
    // para los dos, y el `Map` de listeners compartido.
    expect(channels).toHaveLength(2);

    // El eco que llega por el canal del primero es solo del primero.
    channels[0].handlers[0]({ new: { id: 'match-ajeno' } });
    expect(enUno).toHaveBeenCalledTimes(1);
    expect(enOtro).not.toHaveBeenCalled();

    // Y cerrar el primero no cierra el canal del segundo.
    salirDeUno();
    expect(channels).toHaveLength(2);
    channels[1].handlers[0]({ new: { id: 'match-ajeno' } });
    expect(enOtro).toHaveBeenCalledTimes(1);
  });

  it('no comparten las marcas de escritura propia', async () => {
    const row = matchRow('match-9');
    const { client, channels } = fakeClient(row);
    asMock.mockReturnValue(client);

    const uno = createSupabaseRepositories();
    const otro = createSupabaseRepositories();

    const enUno = jest.fn();
    const enOtro = jest.fn();
    uno.matches.subscribe(enUno);
    otro.matches.subscribe(enOtro);

    // La escritura la hace el primero: avisa a los suyos al instante.
    await uno.discovery.recordDecision('user-b', 'like');
    expect(enUno).toHaveBeenCalledTimes(1);
    expect(enOtro).not.toHaveBeenCalled();

    // El eco de esa fila por el canal del primero no repite el aviso...
    channels[0].handlers[0]({ new: { id: row.id } });
    expect(enUno).toHaveBeenCalledTimes(1);

    // ...pero el segundo no escribió nada, así que para él es un cambio ajeno y
    // sí tiene que enterarse. Con la marca compartida se lo perdía.
    channels[1].handlers[0]({ new: { id: row.id } });
    expect(enOtro).toHaveBeenCalledTimes(1);
  });

  it('una ráfaga de escrituras no desaloja la marca de la primera fila', async () => {
    const { client, channels } = fakeClient(matchRow('match-0'));
    asMock.mockReturnValue(client);

    const repositories = createSupabaseRepositories();
    const avisos = jest.fn();
    repositories.matches.subscribe(avisos);

    // La primera fila, y detrás 300 más: por encima del techo de 256 del `Set`
    // con desalojo FIFO que había antes, que habría tirado justo esta marca.
    const rpc = client.rpc as unknown as jest.Mock;
    rpc.mockResolvedValueOnce({ data: matchRow('match-0'), error: null });
    await repositories.discovery.recordDecision('user-b', 'like');

    for (let i = 1; i <= 300; i += 1) {
      rpc.mockResolvedValueOnce({ data: matchRow(`match-${i}`), error: null });
      await repositories.discovery.recordDecision('user-b', 'like');
    }

    const avisosLocales = avisos.mock.calls.length;

    // El eco tardío de la primera fila sigue silenciado.
    channels[0].handlers[0]({ new: { id: 'match-0' } });
    expect(avisos).toHaveBeenCalledTimes(avisosLocales);
  });
});

describe('recordDecision contra el RPC', () => {
  // El contrato de Supabase solo corre en CI; esto fija en la suite por defecto
  // qué argumentos viajan. Sin modo, la llamada de dos argumentos de siempre.
  it('manda `p_mode` solo cuando la pantalla decide con un modo', async () => {
    const { client } = fakeClient();
    asMock.mockReturnValue(client);
    const repositories = createSupabaseRepositories();

    await repositories.discovery.recordDecision('user-b', 'like', 'lockin');
    await repositories.discovery.recordDecision('user-c', 'pass');

    expect(client.rpc).toHaveBeenNthCalledWith(1, 'record_decision', {
      p_target_id: 'user-b',
      p_decision: 'like',
      p_mode: 'lockin',
    });
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'record_decision', {
      p_target_id: 'user-c',
      p_decision: 'pass',
    });
  });
});

describe('verifyGithub', () => {
  it('con GitHub ya vinculado sin sello, lo sella sin volver a abrir GitHub', async () => {
    // Una vuelta en frío perdida: la identidad está en GoTrue y el sello no.
    asMock.mockReturnValue(fakeClient().client);
    jest.mocked(adoptLinkedGithubIdentity).mockResolvedValueOnce(true);
    const repositories = createSupabaseRepositories();
    const verified = buildProfile({ id: 'user-a' });
    jest.spyOn(repositories.profiles, 'getCurrent').mockResolvedValue(verified);

    await expect(repositories.profiles.verifyGithub()).resolves.toBe(verified);

    expect(linkGithubIdentity).not.toHaveBeenCalled();
  });

  it('sin GitHub vinculado abre el flujo de siempre', async () => {
    asMock.mockReturnValue(fakeClient().client);
    jest.mocked(linkGithubIdentity).mockResolvedValueOnce(true);
    const repositories = createSupabaseRepositories();
    jest.spyOn(repositories.profiles, 'getCurrent').mockResolvedValue(buildProfile());

    await repositories.profiles.verifyGithub();

    expect(adoptLinkedGithubIdentity).toHaveBeenCalled();
    expect(linkGithubIdentity).toHaveBeenCalledTimes(1);
  });
});
