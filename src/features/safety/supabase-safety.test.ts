import { createSupabaseRepositories } from '@/data/supabase';

import type { LockInSupabaseClient } from '@/data/supabase/client';

function setup() {
  const channel = { on: jest.fn().mockReturnThis(), subscribe: jest.fn().mockReturnThis() };
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

describe('adaptador Supabase de seguridad (cliente doble, sin servidor)', () => {
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
