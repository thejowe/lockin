/**
 * `useActiveSession` relee **las dos** consultas, no solo la de la sesión viva.
 *
 * `useQuery` da un `refresh` por consulta (`src/data/provider.tsx`), así que
 * este es el fallo silencioso del hook: si el tic de 30 s o el aviso del
 * repositorio releyeran solo la viva, la tarjeta del chat se quedaría pidiendo
 * una valoración ya escrita hasta salir del chat, porque nadie volvería a
 * preguntar por `getRatable`.
 *
 * Ojo: en RNTL 14 `renderHook` es asíncrono.
 */

import { act, renderHook } from '@testing-library/react-native';

import { DataProvider } from '@/data';
import { createMockRepositories, resetState } from '@/data/mock';

import { SESSION_TICK_MS, useActiveSession } from './use-active-session';

import type { Repositories } from '@/data';

let repositories: Repositories;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <DataProvider value={repositories}>{children}</DataProvider>
);

beforeEach(() => {
  jest.useFakeTimers();
  resetState();
  repositories = createMockRepositories();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useActiveSession', () => {
  it('el tic de 30 s relee la sesión viva, la valorable y la racha', async () => {
    const getActive = jest.spyOn(repositories.sessions, 'getActive');
    const getRatable = jest.spyOn(repositories.sessions, 'getRatable');
    const listStreaks = jest.spyOn(repositories.sessions, 'listStreaks');

    const { result } = await renderHook(() => useActiveSession('m1'), { wrapper });
    await act(async () => {});
    expect(result.current.session).toBeNull();
    expect(result.current.ratable).toBeNull();
    expect(result.current.streak).toBeNull();
    expect(getActive).toHaveBeenCalledTimes(1);
    expect(getRatable).toHaveBeenCalledTimes(1);
    expect(listStreaks).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(SESSION_TICK_MS);
    });

    expect(getActive).toHaveBeenCalledTimes(2);
    expect(getRatable).toHaveBeenCalledTimes(2);
    expect(listStreaks).toHaveBeenCalledTimes(2);
  });

  it('un aviso del repositorio relee también las tres', async () => {
    const subscribe = jest.spyOn(repositories.sessions, 'subscribe');
    const getActive = jest.spyOn(repositories.sessions, 'getActive');
    const getRatable = jest.spyOn(repositories.sessions, 'getRatable');
    const listStreaks = jest.spyOn(repositories.sessions, 'listStreaks');

    await renderHook(() => useActiveSession('m1'), { wrapper });
    await act(async () => {});
    const listener = subscribe.mock.calls[0][1];

    await act(async () => listener());

    expect(getActive).toHaveBeenCalledTimes(2);
    expect(getRatable).toHaveBeenCalledTimes(2);
    expect(listStreaks).toHaveBeenCalledTimes(2);
  });

  it('si listStreaks rechaza, la racha es null y no rompe las otras', async () => {
    jest.spyOn(repositories.sessions, 'listStreaks').mockRejectedValue(new Error('sin red'));

    const { result } = await renderHook(() => useActiveSession('m1'), { wrapper });
    await act(async () => {});

    expect(result.current.streak).toBeNull();
    expect(result.current.session).toBeNull();
  });
});
