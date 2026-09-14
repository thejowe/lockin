/** Adaptador de presencia sobre Realtime, con un canal falso: sin red. */

import { createSupabasePresenceAdapter } from './presence';

import type { LockInSupabaseClient } from './client';

interface FakeChannel {
  on: jest.Mock<FakeChannel, [string, unknown, () => void]>;
  subscribe: jest.Mock<FakeChannel, [(status: string) => void]>;
  presenceState: () => Record<string, unknown[]>;
  track: jest.Mock<Promise<string>, unknown[]>;
  untrack: jest.Mock<Promise<string>, unknown[]>;
}

function fakeRealtime() {
  let onSync: () => void = () => {};
  let onStatus: (status: string) => void = () => {};
  const state: Record<string, unknown[]> = {};
  const channel: FakeChannel = {
    on: jest.fn((_type: string, _filter: unknown, callback: () => void) => {
      onSync = callback;
      return channel;
    }),
    subscribe: jest.fn((callback: (status: string) => void) => {
      onStatus = callback;
      return channel;
    }),
    presenceState: () => state,
    track: jest.fn(async () => 'ok'),
    untrack: jest.fn(async () => 'ok'),
  };
  const client = {
    channel: jest.fn(() => channel),
    removeChannel: jest.fn(async () => 'ok'),
  };
  return {
    client: client as unknown as LockInSupabaseClient,
    rawClient: client,
    channel,
    state,
    sync: () => onSync(),
    status: (value: string) => onStatus(value),
  };
}

describe('createSupabasePresenceAdapter', () => {
  it('se anuncia con su perfil como clave al conectar y publica quién está', () => {
    const realtime = fakeRealtime();
    const adapter = createSupabasePresenceAdapter(() => realtime.client);
    const handlers = { onPeers: jest.fn(), onConnection: jest.fn() };

    adapter.join('s1', 'ana', handlers);
    realtime.status('SUBSCRIBED');
    realtime.state.ana = [{}];
    realtime.state.bea = [{}];
    realtime.sync();

    expect(realtime.rawClient.channel).toHaveBeenCalledWith('lockin:presence:s1', {
      config: { presence: { key: 'ana' } },
    });
    expect(handlers.onConnection).toHaveBeenCalledWith(true);
    expect(realtime.channel.track).toHaveBeenCalledWith({ profileId: 'ana' });
    expect(handlers.onPeers).toHaveBeenLastCalledWith(['ana', 'bea']);
  });

  it.each(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'])('%s se publica como sin conexión', (value) => {
    const realtime = fakeRealtime();
    const handlers = { onPeers: jest.fn(), onConnection: jest.fn() };
    createSupabasePresenceAdapter(() => realtime.client).join('s1', 'ana', handlers);

    realtime.status(value);

    expect(handlers.onConnection).toHaveBeenLastCalledWith(false);
  });

  it('salir deja de anunciarse y cierra el canal', () => {
    const realtime = fakeRealtime();
    const leave = createSupabasePresenceAdapter(() => realtime.client).join('s1', 'ana', {
      onPeers: jest.fn(),
      onConnection: jest.fn(),
    });

    leave();

    expect(realtime.channel.untrack).toHaveBeenCalled();
    expect(realtime.rawClient.removeChannel).toHaveBeenCalledWith(realtime.channel);
  });
});
