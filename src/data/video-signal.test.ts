/** Adaptador de señalización de vídeo en memoria: el del backend mock y el de los tests. */

import { createMemoryVideoSignalAdapter } from './video-signal';

import type { VideoSignalMessage } from './video-signal';

function offer(from: string): VideoSignalMessage {
  return { kind: 'offer', from, payload: { type: 'offer', sdp: 'sdp' } };
}

describe('createMemoryVideoSignalAdapter', () => {
  it('dos perfiles en la misma sesión se reciben los mensajes el uno al otro', () => {
    const adapter = createMemoryVideoSignalAdapter();
    const a = { onMessage: jest.fn(), onConnection: jest.fn() };
    const b = { onMessage: jest.fn(), onConnection: jest.fn() };
    adapter.join('s1', 'ana', a);
    adapter.join('s1', 'bea', b);

    adapter.send('s1', offer('ana'));

    expect(a.onConnection).toHaveBeenCalledWith(true);
    expect(b.onMessage).toHaveBeenCalledWith(offer('ana'));
    expect(a.onMessage).not.toHaveBeenCalled();
  });

  it('un mensaje propio no vuelve como eco', () => {
    const adapter = createMemoryVideoSignalAdapter();
    const a = { onMessage: jest.fn(), onConnection: jest.fn() };
    adapter.join('s1', 'ana', a);

    adapter.send('s1', offer('ana'));

    expect(a.onMessage).not.toHaveBeenCalled();
  });

  it('salir deja de recibir', () => {
    const adapter = createMemoryVideoSignalAdapter();
    const a = { onMessage: jest.fn(), onConnection: jest.fn() };
    const b = { onMessage: jest.fn(), onConnection: jest.fn() };
    adapter.join('s1', 'ana', a);
    const leave = adapter.join('s1', 'bea', b);

    leave();
    adapter.send('s1', offer('ana'));

    expect(b.onMessage).not.toHaveBeenCalled();
  });

  it('dos sesiones distintas no se cruzan mensajes', () => {
    const adapter = createMemoryVideoSignalAdapter();
    const inS1 = { onMessage: jest.fn(), onConnection: jest.fn() };
    const inS2 = { onMessage: jest.fn(), onConnection: jest.fn() };
    adapter.join('s1', 'bea', inS1);
    adapter.join('s2', 'carla', inS2);

    adapter.send('s1', offer('ana'));

    expect(inS1.onMessage).toHaveBeenCalledWith(offer('ana'));
    expect(inS2.onMessage).not.toHaveBeenCalled();
  });

  it('mandar a una sesión sin nadie no revienta', () => {
    const adapter = createMemoryVideoSignalAdapter();

    expect(() => adapter.send('vacia', offer('ana'))).not.toThrow();
  });
});
