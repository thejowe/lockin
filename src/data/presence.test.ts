/** Adaptador de presencia en memoria: el del backend mock y el de los tests de pantalla. */

import { createMemoryPresenceAdapter } from './presence';

describe('createMemoryPresenceAdapter', () => {
  it('cada persona que entra ve a todas las que están en esa sesión', () => {
    const adapter = createMemoryPresenceAdapter();
    const a = { onPeers: jest.fn(), onConnection: jest.fn() };
    const b = { onPeers: jest.fn(), onConnection: jest.fn() };

    adapter.join('s1', 'ana', a);
    adapter.join('s1', 'bea', b);

    expect(a.onConnection).toHaveBeenCalledWith(true);
    expect(a.onPeers).toHaveBeenLastCalledWith(['ana', 'bea']);
    expect(b.onPeers).toHaveBeenLastCalledWith(['ana', 'bea']);
  });

  it('salir avisa al resto y no mezcla sesiones distintas', () => {
    const adapter = createMemoryPresenceAdapter();
    const a = { onPeers: jest.fn(), onConnection: jest.fn() };
    const other = { onPeers: jest.fn(), onConnection: jest.fn() };
    adapter.join('s1', 'ana', a);
    const leave = adapter.join('s1', 'bea', { onPeers: jest.fn(), onConnection: jest.fn() });
    adapter.join('s2', 'carla', other);

    leave();

    expect(a.onPeers).toHaveBeenLastCalledWith(['ana']);
    expect(other.onPeers).toHaveBeenLastCalledWith(['carla']);
  });

  it('la misma persona con dos pantallas abiertas cuenta una vez y sigue tras cerrar una', () => {
    const adapter = createMemoryPresenceAdapter();
    const watcher = { onPeers: jest.fn(), onConnection: jest.fn() };
    adapter.join('s1', 'ana', watcher);
    const first = adapter.join('s1', 'bea', { onPeers: jest.fn(), onConnection: jest.fn() });
    adapter.join('s1', 'bea', { onPeers: jest.fn(), onConnection: jest.fn() });

    first();

    expect(watcher.onPeers).toHaveBeenLastCalledWith(['ana', 'bea']);
  });
});
