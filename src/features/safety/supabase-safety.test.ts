import { createSupabaseRepositories } from '@/data/supabase';
import { createSupabasePresenceAdapter } from '@/data/supabase/presence';
import { createSupabaseVideoSignalAdapter } from '@/data/supabase/video-signal';

import type { LockInSupabaseClient } from '@/data/supabase/client';

function setup() {
  const channel = {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
    track: jest.fn(),
    untrack: jest.fn(),
    send: jest.fn(),
    presenceState: jest.fn(() => ({})),
  };
  const client = {
    rpc: jest.fn(async () => ({
      data: null,
      error: null as { code: string; message: string } | null,
    })),
    from: jest.fn(),
    channel: jest.fn(() => channel),
    removeChannel: jest.fn(),
  };
  const repositories = createSupabaseRepositories({
    getClient: () => client as unknown as LockInSupabaseClient,
    getUserId: async () => 'a',
  });
  return { client, repositories };
}

/** `from()` que responde a las lecturas previas al bloqueo con estas filas. */
function tables(rows: Record<string, unknown[]>) {
  return jest.fn((table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of ['select', 'or', 'in', 'eq', 'order', 'range'])
      query[method] = () => query;
    query.then = (resolve: (value: unknown) => void) =>
      resolve({ data: rows[table] ?? [], error: null });
    return query;
  });
}

describe('adaptador Supabase de seguridad (cliente doble, sin servidor)', () => {
  it('bloquear avisa también a los suscriptores de salas', async () => {
    const { repositories } = setup();
    const rooms = jest.fn();
    const close = repositories.rooms.subscribe(rooms);
    await repositories.profiles.block('b');
    expect(rooms).toHaveBeenCalledTimes(1);
    close();
  });

  it('bloquear no avisa a las salas si el RPC falla', async () => {
    const { repositories, client } = setup();
    const rooms = jest.fn();
    const close = repositories.rooms.subscribe(rooms);
    client.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'no' } });
    await expect(repositories.profiles.block('b')).rejects.toBeTruthy();
    expect(rooms).not.toHaveBeenCalled();
    close();
  });

  it('bloquear corta los canales de presencia y vídeo compartidos con esa persona, y solo esos', async () => {
    const { repositories, client } = setup();
    client.from = tables({
      matches: [{ id: 'm1' }],
      lockin_sessions: [{ id: 'con-b' }],
      lockin_rooms: [{ id: 'sala-de-b' }],
      room_members: [],
    });
    const getClient = () => client as unknown as LockInSupabaseClient;
    const presence = createSupabasePresenceAdapter(getClient);
    const roomPresence = createSupabasePresenceAdapter(getClient, 'lockin:room:');
    const video = createSupabaseVideoSignalAdapter(getClient);
    const handlers = () => ({
      onPeers: jest.fn(),
      onMessage: jest.fn(),
      onConnection: jest.fn(),
      onRevoked: jest.fn(),
    });
    const withB = { presence: handlers(), video: handlers(), room: handlers() };
    const other = { presence: handlers(), video: handlers() };
    presence.join('con-b', 'a', withB.presence);
    video.join('con-b', 'a', withB.video);
    roomPresence.join('sala-de-b', 'a', withB.room);
    presence.join('con-otra-persona', 'a', other.presence);
    video.join('con-otra-persona', 'a', other.video);

    await repositories.profiles.block('b');

    for (const h of Object.values(withB)) {
      expect(h.onRevoked).toHaveBeenCalledTimes(1);
      expect(h.onConnection).toHaveBeenLastCalledWith(false);
    }
    for (const h of Object.values(other)) expect(h.onRevoked).not.toHaveBeenCalled();
    // Cerrar de nuevo al salir con normalidad no repite nada.
    expect(client.removeChannel).toHaveBeenCalledTimes(3);
  });

  it('si no puede averiguar con quién estaba cada canal, cierra todos', async () => {
    const { repositories, client } = setup();
    // Sin `from` utilizable: la lectura previa falla.
    client.from = jest.fn(() => {
      throw new Error('sin red');
    });
    const presence = createSupabasePresenceAdapter(() => client as unknown as LockInSupabaseClient);
    const onRevoked = jest.fn();
    presence.join('cualquiera', 'a', { onPeers: jest.fn(), onConnection: jest.fn(), onRevoked });
    await repositories.profiles.block('b');
    expect(onRevoked).toHaveBeenCalledTimes(1);
  });

  it('bloquear llama al RPC y avisa solo a los lectores de esta instancia', async () => {
    const { repositories: a, client } = setup();
    const { repositories: b } = setup();
    const matchesA = jest.fn();
    const messagesA = jest.fn();
    const matchesB = jest.fn();
    const closeA = a.matches.subscribe(matchesA);
    const closeMessages = a.messages.subscribe('match', messagesA);
    const closeB = b.matches.subscribe(matchesB);
    await a.profiles.block('b');
    expect(client.rpc).toHaveBeenCalledWith('block_profile', { p_profile_id: 'b' });
    expect(matchesA).toHaveBeenCalledTimes(1);
    expect(messagesA).toHaveBeenCalledTimes(1);
    expect(matchesB).not.toHaveBeenCalled();
    closeA();
    closeMessages();
    closeB();
  });

  it('reportar escribe por RPC sin consultar tablas privadas ni devolver filas', async () => {
    const { repositories, client } = setup();
    await expect(
      repositories.profiles.report({ profileId: 'b', reason: 'acoso', details: 'Detalle' })
    ).resolves.toBeUndefined();
    expect(client.rpc).toHaveBeenCalledWith('report_profile', {
      p_profile_id: 'b',
      p_reason: 'acoso',
      p_details: 'Detalle',
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('un like bloqueado llega como fila de nulos y no se entrega como match', async () => {
    const { repositories, client } = setup();
    // PostgREST devuelve el compuesto NULL de `record_decision` como una fila de nulos.
    client.rpc.mockResolvedValueOnce({
      data: { id: null, profile_a: null, profile_b: null, mode: null } as never,
      error: null,
    });
    const matches = jest.fn();
    const close = repositories.matches.subscribe(matches);
    await expect(repositories.discovery.recordDecision('b', 'like')).resolves.toEqual({
      decision: 'like',
      match: null,
    });
    expect(matches).not.toHaveBeenCalled();
    close();
  });

  it('traduce LI008 y LI009 manteniendo el código de contrato', async () => {
    const { repositories, client } = setup();
    client.rpc.mockResolvedValueOnce({ data: null, error: { code: 'LI008', message: 'sql' } });
    await expect(repositories.profiles.block('a')).rejects.toMatchObject({
      code: 'LI008',
      message: 'No puedes bloquearte ni reportarte a ti mismo.',
    });
    client.rpc.mockResolvedValueOnce({ data: null, error: { code: 'LI009', message: 'sql' } });
    await expect(
      repositories.profiles.report({ profileId: 'b', reason: 'otro' })
    ).rejects.toMatchObject({ code: 'LI009', message: 'Elige un motivo válido.' });
  });
});
