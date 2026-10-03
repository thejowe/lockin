import { act, renderHook } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import { DataProvider, SessionConflictError } from '@/data';
import { createMockRepositories } from '@/data/mock';

import { useRoom } from './use-room';

import type { LockInRoom, Repositories, RoomMember, RoomView } from '@/data';

let repositories: Repositories;
let notify: () => void;
const unsubscribe = jest.fn();
const now = new Date(2026, 9, 3, 12).getTime();
const wrapper = (props: { children: ReactNode }) =>
  createElement(DataProvider, { ...props, value: repositories });

const startsAt = new Date(now + 30 * 60_000).toISOString();
const member: RoomMember = {
  roomId: 'room',
  profileId: 'me',
  status: 'invitada',
  respondedAt: null,
  joinedAt: null,
  leftAt: null,
};
const room: LockInRoom = {
  id: 'room',
  hostId: 'ana',
  startsAt,
  blocks: 1,
  cancelledAt: null,
  createdAt: startsAt,
};
const view: RoomView = { room, me: member, others: [] };

/** Una promesa que el test resuelve cuando quiere. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(now);
  unsubscribe.mockClear();
  const base = createMockRepositories();
  repositories = {
    ...base,
    sessions: {
      ...base.sessions,
      serverNow: jest.fn().mockResolvedValue(new Date(now + 4_000).toISOString()),
    },
    rooms: {
      ...base.rooms,
      getById: jest.fn().mockResolvedValue(view),
      respond: jest.fn().mockResolvedValue({ ...member, status: 'aceptada' }),
      cancel: jest.fn().mockResolvedValue(room),
      join: jest.fn().mockResolvedValue(member),
      leave: jest.fn().mockResolvedValue(member),
      subscribe: jest.fn((listener) => {
        notify = listener;
        return unsubscribe;
      }),
    },
  };
});
afterEach(() => {
  jest.useRealTimers();
});

it('carga la sala por su id', async () => {
  const { result } = await renderHook(() => useRoom('room'), { wrapper });
  expect(repositories.rooms.getById).toHaveBeenCalledWith('room');
  expect(result.current.view).toEqual(view);
  expect(result.current.loading).toBe(false);
  expect(result.current.error).toBeNull();
  expect(result.current.pending).toBe(false);
});

it('relee con cada aviso de la suscripción, y la suelta al desmontar', async () => {
  const { result, unmount } = await renderHook(() => useRoom('room'), { wrapper });
  jest.mocked(repositories.rooms.getById).mockResolvedValue(null);
  await act(async () => notify());
  expect(repositories.rooms.getById).toHaveBeenCalledTimes(2);
  expect(result.current.view).toBeNull();
  await unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

it('corrige el reloj con la hora del servidor', async () => {
  const { result } = await renderHook(() => useRoom('room'), { wrapper });
  expect(result.current.offsetMs).toBe(4_000);
});

it('sin hora del servidor sigue con la del dispositivo', async () => {
  jest.mocked(repositories.sessions.serverNow).mockRejectedValue(new Error('sin red'));
  const { result } = await renderHook(() => useRoom('room'), { wrapper });
  expect(result.current.offsetMs).toBe(0);
});

it('marca pending mientras vuela una respuesta y escribe una sola vez por doble toque', async () => {
  const write = deferred<RoomMember>();
  jest.mocked(repositories.rooms.respond).mockReturnValue(write.promise);
  const { result } = await renderHook(() => useRoom('room'), { wrapper });

  let first!: Promise<void>;
  await act(async () => {
    first = result.current.respond('aceptada');
    void result.current.respond('aceptada');
  });
  expect(result.current.pending).toBe(true);
  expect(repositories.rooms.respond).toHaveBeenCalledTimes(1);
  expect(repositories.rooms.respond).toHaveBeenCalledWith('room', 'aceptada');

  await act(async () => {
    write.resolve({ ...member, status: 'aceptada' });
    await first;
  });
  expect(result.current.pending).toBe(false);
});

it('cancelar también es una sola escritura', async () => {
  const { result } = await renderHook(() => useRoom('room'), { wrapper });
  await act(async () => {
    void result.current.cancel();
    await result.current.cancel();
  });
  expect(repositories.rooms.cancel).toHaveBeenCalledTimes(1);
  expect(repositories.rooms.cancel).toHaveBeenCalledWith('room');
});

it('un fallo llega a quien llama, suelta pending y relee', async () => {
  jest.mocked(repositories.rooms.respond).mockRejectedValue(new SessionConflictError('cancelada'));
  const { result } = await renderHook(() => useRoom('room'), { wrapper });

  await act(async () => {
    await expect(result.current.respond('aceptada')).rejects.toBeInstanceOf(SessionConflictError);
  });
  expect(result.current.pending).toBe(false);
  expect(repositories.rooms.getById).toHaveBeenCalledTimes(2);
});

it('entrar y salir van a la sala del hook', async () => {
  const { result } = await renderHook(() => useRoom('room'), { wrapper });
  await act(async () => {
    await result.current.join();
    await result.current.leave();
  });
  expect(repositories.rooms.join).toHaveBeenCalledWith('room');
  expect(repositories.rooms.leave).toHaveBeenCalledWith('room');
});
