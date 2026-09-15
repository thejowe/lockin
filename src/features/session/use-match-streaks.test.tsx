/**
 * `useMatchStreaks` lee las rachas una vez para toda la lista, no una por fila,
 * y las relee al volver a la pestaña.
 *
 * `useFocusEffect` se sustituye por uno que guarda el efecto: así el test puede
 * simular "vuelve el foco" llamándolo otra vez, sin montar navegación real.
 *
 * Ojo: en RNTL 14 `renderHook` es asíncrono.
 */

import { act, renderHook } from '@testing-library/react-native';

import { DataProvider } from '@/data';
import { createMockRepositories, resetState } from '@/data/mock';

import { useMatchStreaks } from './use-match-streaks';

import type { MatchStreak, Repositories } from '@/data';

const mockFocusEffects: (() => void | (() => void))[] = [];

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    mockFocusEffects.push(effect);
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]);
  },
}));

let repositories: Repositories;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <DataProvider value={repositories}>{children}</DataProvider>
);

const DAY = 24 * 60 * 60_000;

function streak(matchId: string, count: number): MatchStreak {
  return { matchId, count, aliveUntil: new Date(Date.now() + DAY).toISOString() };
}

beforeEach(() => {
  jest.restoreAllMocks();
  mockFocusEffects.length = 0;
  resetState();
  repositories = createMockRepositories();
});

describe('useMatchStreaks', () => {
  it('pide las rachas una sola vez al montar, no una por match', async () => {
    const listStreaks = jest.spyOn(repositories.sessions, 'listStreaks');

    const { result } = await renderHook(() => useMatchStreaks(), { wrapper });
    await act(async () => {});
    result.current.streakFor('m1');
    result.current.streakFor('m2');
    result.current.streakFor('m3');

    expect(listStreaks).toHaveBeenCalledTimes(1);
  });

  it('streakFor pinta desde 2, oculta 1 y sin entrada da null', async () => {
    jest
      .spyOn(repositories.sessions, 'listStreaks')
      .mockResolvedValue([streak('m2', 2), streak('m1', 1)]);

    const { result } = await renderHook(() => useMatchStreaks(), { wrapper });
    await act(async () => {});

    expect(result.current.streakFor('m2')).toBe(2);
    expect(result.current.streakFor('m1')).toBeNull();
    expect(result.current.streakFor('otro')).toBeNull();
  });

  it('si listStreaks rechaza, null para todos', async () => {
    jest.spyOn(repositories.sessions, 'listStreaks').mockRejectedValue(new Error('sin red'));

    const { result } = await renderHook(() => useMatchStreaks(), { wrapper });
    await act(async () => {});

    expect(result.current.streakFor('m2')).toBeNull();
  });

  it('volver a la pestaña relee las rachas', async () => {
    const listStreaks = jest.spyOn(repositories.sessions, 'listStreaks');

    await renderHook(() => useMatchStreaks(), { wrapper });
    await act(async () => {});
    expect(listStreaks).toHaveBeenCalledTimes(1);

    await act(async () => {
      mockFocusEffects[mockFocusEffects.length - 1]();
    });

    expect(listStreaks).toHaveBeenCalledTimes(2);
  });

  it('refresh relee las rachas', async () => {
    const listStreaks = jest.spyOn(repositories.sessions, 'listStreaks');

    const { result } = await renderHook(() => useMatchStreaks(), { wrapper });
    await act(async () => {});

    await act(async () => result.current.refresh());

    expect(listStreaks).toHaveBeenCalledTimes(2);
  });
});
