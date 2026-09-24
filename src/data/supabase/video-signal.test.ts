/** Adaptador de señalización de vídeo sobre Realtime, con un canal falso: sin red. */

import { createSupabaseVideoSignalAdapter } from './video-signal';

import type { LockInSupabaseClient } from './client';
import type { VideoSignalMessage } from '../video-signal';

interface FakeChannel {
  on: jest.Mock<FakeChannel, [string, unknown, (payload: { payload: VideoSignalMessage }) => void]>;
  subscribe: jest.Mock<FakeChannel, [(status: string) => void]>;
  send: jest.Mock<Promise<string>, unknown[]>;
}

function fakeRealtime() {
  let onBroadcast: (payload: { payload: VideoSignalMessage }) => void = () => {};
  let onStatus: (status: string) => void = () => {};
  const channel: FakeChannel = {
    on: jest.fn(
      (
        _type: string,
        _filter: unknown,
        callback: (payload: { payload: VideoSignalMessage }) => void
      ) => {
        onBroadcast = callback;
        return channel;
      }
    ),
    subscribe: jest.fn((callback: (status: string) => void) => {
      onStatus = callback;
      return channel;
    }),
    send: jest.fn(async () => 'ok'),
  };
  const client = {
    channel: jest.fn(() => channel),
    removeChannel: jest.fn(async () => 'ok'),
  };
  return {
    client: client as unknown as LockInSupabaseClient,
    rawClient: client,
    channel,
    broadcast: (message: VideoSignalMessage) => onBroadcast({ payload: message }),
    status: (value: string) => onStatus(value),
  };
}

function offer(from: string): VideoSignalMessage {
  return { kind: 'offer', from, payload: { type: 'offer', sdp: 'sdp' } };
}

describe('createSupabaseVideoSignalAdapter', () => {
  it('configura el topic privado y registra el evento signal del SDK', () => {
    const realtime = fakeRealtime();
    const adapter = createSupabaseVideoSignalAdapter(() => realtime.client);
    const handlers = { onMessage: jest.fn(), onConnection: jest.fn() };

    adapter.join('s1', 'ana', handlers);
    realtime.status('SUBSCRIBED');

    // `private: true` no es cosmético: es lo que hace que el servidor evalúe las
    // políticas de `realtime.messages` de `20260917000100_realtime_authorization.sql`.
    // Sin él, el canal vuelve a ser público y la migración no protege nada.
    expect(realtime.rawClient.channel).toHaveBeenCalledWith('lockin:video:s1', {
      config: { private: true },
    });
    expect(realtime.channel.on).toHaveBeenCalledWith(
      'broadcast',
      { event: 'signal' },
      expect.any(Function)
    );
  });

  it.each(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'])('%s se publica como sin conexión', (value) => {
    const realtime = fakeRealtime();
    const handlers = { onMessage: jest.fn(), onConnection: jest.fn() };
    createSupabaseVideoSignalAdapter(() => realtime.client).join('s1', 'ana', handlers);

    realtime.status(value);

    expect(handlers.onConnection).toHaveBeenLastCalledWith(false);
  });

  it('desempaqueta payload del evento broadcast signal', () => {
    const realtime = fakeRealtime();
    const handlers = { onMessage: jest.fn(), onConnection: jest.fn() };
    createSupabaseVideoSignalAdapter(() => realtime.client).join('s1', 'bea', handlers);

    realtime.broadcast(offer('ana'));

    expect(handlers.onMessage).toHaveBeenCalledWith(offer('ana'));
  });

  it('filtra from aunque el SDK entregue un broadcast del mismo perfil', () => {
    const realtime = fakeRealtime();
    const handlers = { onMessage: jest.fn(), onConnection: jest.fn() };
    createSupabaseVideoSignalAdapter(() => realtime.client).join('s1', 'ana', handlers);

    realtime.broadcast(offer('ana'));

    expect(handlers.onMessage).not.toHaveBeenCalled();
  });

  it('enviar transmite por el canal de la sesión ya unida', () => {
    const realtime = fakeRealtime();
    const adapter = createSupabaseVideoSignalAdapter(() => realtime.client);
    adapter.join('s1', 'ana', { onMessage: jest.fn(), onConnection: jest.fn() });

    adapter.send('s1', offer('ana'));

    expect(realtime.channel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'signal',
      payload: offer('ana'),
    });
  });

  it('sin canal abierto no llama a send del SDK', () => {
    const realtime = fakeRealtime();
    const adapter = createSupabaseVideoSignalAdapter(() => realtime.client);

    adapter.send('vacia', offer('ana'));
    expect(realtime.channel.send).not.toHaveBeenCalled();
  });

  it('ignora eventos tardíos del SDK después del cleanup, incluido SUBSCRIBED', () => {
    const realtime = fakeRealtime();
    const handlers = { onMessage: jest.fn(), onConnection: jest.fn() };
    const leave = createSupabaseVideoSignalAdapter(() => realtime.client).join(
      's1',
      'ana',
      handlers
    );
    leave();
    realtime.status('SUBSCRIBED');
    realtime.status('CLOSED');
    realtime.broadcast(offer('bea'));
    expect(handlers.onConnection).not.toHaveBeenCalled();
    expect(handlers.onMessage).not.toHaveBeenCalled();
  });

  it('salir cierra el canal y deja de poder enviar', () => {
    const realtime = fakeRealtime();
    const adapter = createSupabaseVideoSignalAdapter(() => realtime.client);
    const leave = adapter.join('s1', 'ana', { onMessage: jest.fn(), onConnection: jest.fn() });

    leave();
    adapter.send('s1', offer('ana'));

    expect(realtime.rawClient.removeChannel).toHaveBeenCalledWith(realtime.channel);
    expect(realtime.channel.send).not.toHaveBeenCalled();
  });
});
