import { act, renderHook } from '@testing-library/react-native';

import { createMemoryPresenceAdapter, presence, roomPresence } from '@/data';

import { useRoomPresence } from './index';

import type { PresenceAdapter, PresenceHandlers } from '@/data';

const handlers = () => ({ onPeers: jest.fn(), onConnection: jest.fn() });

describe('useRoomPresence', () => {
  it.each([
    [null, 'ana'],
    ['r1', null],
  ])('no entra sin sala o perfil (%s, %s)', async (roomId, profileId) => {
    const adapter = createMemoryPresenceAdapter();
    const join = jest.spyOn(adapter, 'join');
    const { result } = await renderHook(() => useRoomPresence(roomId, profileId, adapter));

    expect(join).not.toHaveBeenCalled();
    expect(result.current.presentIds.size).toBe(0);
  });

  it('dos perfiles se ven y al desmontar desaparece quien sale', async () => {
    const adapter = createMemoryPresenceAdapter();
    const ana = await renderHook(() => useRoomPresence('r1', 'ana', adapter));
    const bea = await renderHook(() => useRoomPresence('r1', 'bea', adapter));

    expect(ana.result.current.presentIds).toEqual(new Set(['ana', 'bea']));
    expect(bea.result.current.presentIds).toEqual(new Set(['ana', 'bea']));
    expect(ana.result.current.online).toBe(true);

    await bea.unmount();
    expect(ana.result.current.presentIds).toEqual(new Set(['ana']));
  });

  it('refleja la desconexión y la recuperación sin duplicar perfiles', async () => {
    let received!: PresenceHandlers;
    const adapter: PresenceAdapter = {
      join: (_room, _profile, callbacks) => {
        received = callbacks;
        return () => {};
      },
    };
    const { result } = await renderHook(() => useRoomPresence('r1', 'ana', adapter));
    await act(async () => {
      received.onPeers(['ana', 'bea', 'bea']);
      received.onConnection(false);
    });
    expect(result.current.online).toBe(false);
    expect(result.current.presentIds).toEqual(new Set(['ana', 'bea']));

    await act(async () => received.onConnection(true));
    expect(result.current.online).toBe(true);
  });

  it('al cerrar la ventana sale y descarta eventos tardíos del canal anterior', async () => {
    const observer = handlers();
    const memory = createMemoryPresenceAdapter();
    const leaveObserver = memory.join('r1', 'bea', observer);
    let received!: PresenceHandlers;
    const adapter: PresenceAdapter = {
      join: (roomId, profileId, callbacks) => {
        received = callbacks;
        return memory.join(roomId, profileId, callbacks);
      },
    };
    const { result, rerender } = await renderHook(
      ({ roomId }: { roomId: string | null }) => useRoomPresence(roomId, 'ana', adapter),
      { initialProps: { roomId: 'r1' as string | null } }
    );

    await rerender({ roomId: null });
    expect(observer.onPeers).toHaveBeenLastCalledWith(['bea']);
    await act(async () => received.onPeers(['ana', 'bea']));
    expect(result.current.presentIds.size).toBe(0);
    leaveObserver();
  });

  it('al cambiar de sala o perfil abandona la presencia anterior', async () => {
    const adapter = createMemoryPresenceAdapter();
    const observer = handlers();
    const leave = adapter.join('r1', 'bea', observer);
    const { result, rerender } = await renderHook(
      ({ roomId, profileId }: { roomId: string; profileId: string }) =>
        useRoomPresence(roomId, profileId, adapter),
      { initialProps: { roomId: 'r1', profileId: 'ana' } }
    );
    await rerender({ roomId: 'r2', profileId: 'ana' });
    expect(observer.onPeers).toHaveBeenLastCalledWith(['bea']);
    expect(result.current.presentIds).toEqual(new Set(['ana']));
    await rerender({ roomId: 'r2', profileId: 'carla' });
    expect(result.current.presentIds).toEqual(new Set(['carla']));
    leave();
  });

  it('usa roomPresence por defecto y no mezcla salas con sesiones del mismo id', async () => {
    const leaveSession = presence.join('same-id', 'session-peer', handlers());
    const leaveRoom = roomPresence.join('same-id', 'room-peer', handlers());
    const { result, unmount } = await renderHook(() => useRoomPresence('same-id', 'ana'));

    expect(result.current.presentIds).toEqual(new Set(['room-peer', 'ana']));
    await unmount();
    leaveSession();
    leaveRoom();
  });
});
