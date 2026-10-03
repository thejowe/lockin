import { act, renderHook } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import { DataProvider } from '@/data';
import { createMockRepositories } from '@/data/mock';

import { useLiveRooms } from './use-live-rooms';

import type { Repositories, RoomView } from '@/data';

const mockFocusEffects: (() => void)[] = [];
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => {
    mockFocusEffects.push(effect);
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]);
  },
}));

let repositories: Repositories;
let notify: () => void;
const unsubscribe = jest.fn();
const now = new Date(2026, 9, 3, 12).getTime();
const wrapper = (props: { children: ReactNode }) =>
  createElement(DataProvider, { ...props, value: repositories });

function room(id = 'room'): RoomView {
  const startsAt = new Date(now - 30 * 60_000 + 30_000).toISOString();
  return {
    room: { id, hostId: 'me', startsAt, blocks: 1, cancelledAt: null, createdAt: startsAt },
    me: {
      roomId: id,
      profileId: 'me',
      status: 'aceptada',
      respondedAt: null,
      joinedAt: null,
      leftAt: null,
    },
    others: [],
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(now);
  mockFocusEffects.length = 0;
  unsubscribe.mockClear();
  const base = createMockRepositories();
  repositories = {
    ...base,
    rooms: {
      ...base.rooms,
      listLive: jest.fn().mockResolvedValue([room()]),
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

it('lee al montar una sola vez, sin duplicar por el primer foco', async () => {
  const { result } = await renderHook(() => useLiveRooms(), { wrapper });
  expect(repositories.rooms.listLive).toHaveBeenCalledTimes(1);
  expect(result.current.rooms).toEqual([room()]);
  expect(result.current.loading).toBe(false);
  expect(result.current.error).toBeNull();
});

it('relee con la suscripción y sustituye la lista', async () => {
  const { result } = await renderHook(() => useLiveRooms(), { wrapper });
  jest.mocked(repositories.rooms.listLive).mockResolvedValue([room('otra')]);
  await act(async () => notify());
  expect(repositories.rooms.listLive).toHaveBeenCalledTimes(2);
  expect(result.current.rooms[0].room.id).toBe('otra');
});

it('relee al recuperar el foco', async () => {
  await renderHook(() => useLiveRooms(), { wrapper });
  await act(async () => mockFocusEffects[mockFocusEffects.length - 1]());
  expect(repositories.rooms.listLive).toHaveBeenCalledTimes(2);
});

it('refresh permite recuperar una lectura fallida', async () => {
  const error = new Error('Sin conexión');
  jest.mocked(repositories.rooms.listLive).mockRejectedValueOnce(error);
  const { result } = await renderHook(() => useLiveRooms(), { wrapper });
  expect(result.current.error).toBe(error);
  expect(result.current.rooms).toEqual([]);
  await act(async () => result.current.refresh());
  expect(result.current.error).toBeNull();
  expect(result.current.rooms).toEqual([room()]);
});

it('expone loading mientras la primera lectura está pendiente', async () => {
  let resolve!: (rooms: RoomView[]) => void;
  jest.mocked(repositories.rooms.listLive).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    })
  );
  const { result } = await renderHook(() => useLiveRooms(), { wrapper });
  expect(result.current.loading).toBe(true);
  expect(result.current.rooms).toEqual([]);
  await act(async () => resolve([]));
  expect(result.current.loading).toBe(false);
});

it('el tic de 30 s retira una sala al terminar sin hacer otra lectura', async () => {
  const { result } = await renderHook(() => useLiveRooms(), { wrapper });
  await act(async () => {
    jest.advanceTimersByTime(29_999);
  });
  expect(result.current.rooms).toHaveLength(1);
  await act(async () => {
    jest.advanceTimersByTime(1);
  });
  expect(result.current.rooms).toEqual([]);
  expect(repositories.rooms.listLive).toHaveBeenCalledTimes(1);
});

it('limpia la suscripción y el reloj al desmontar', async () => {
  const clearInterval = jest.spyOn(global, 'clearInterval');
  const { unmount } = await renderHook(() => useLiveRooms(), { wrapper });
  await unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(clearInterval).toHaveBeenCalledTimes(1);
  clearInterval.mockRestore();
});
