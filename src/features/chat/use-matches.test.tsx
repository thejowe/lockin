/**
 * Tests de la lista de matches.
 *
 * `useMatches` es una consulta de una línea más una suscripción, y la
 * suscripción es lo que puede romperse sin que nadie lo note: si deja de
 * engancharse, la lista se queda con el último mensaje viejo al volver de un
 * chat; si deja de desengancharse, cada visita a la pantalla añade un listener
 * que sobrevive al desmontaje.
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';

import { DataProvider } from '@/data';
import { createMockRepositories, resetState } from '@/data/mock';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';

import { useMatches } from './use-matches';

import type { MatchWithProfile, Repositories } from '@/data';

let repositories: Repositories;

function wrapper({ children }: { children: React.ReactNode }) {
  return <DataProvider value={repositories}>{children}</DataProvider>;
}

/** Monta el hook y espera a la primera carga. */
async function renderMatches() {
  const view = await renderHook(() => useMatches(), { wrapper });
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
}

/** Da like a un perfil recíproco y devuelve el id del match creado. */
async function createMatch(profileId: string): Promise<string> {
  const result = await repositories.discovery.recordDecision(profileId, 'like');
  if (!result.match) throw new Error(`${profileId} no generó match`);
  return result.match.id;
}

beforeEach(() => {
  resetState();
  repositories = createMockRepositories();
});

// Los repositorios mock son objetos de módulo: un `spyOn` sobrevive al test que
// lo puso. Restaurarlos aquí evita que un envío falseado contamine al siguiente.
afterEach(() => {
  jest.restoreAllMocks();
});

describe('useMatches', () => {
  it('sin matches devuelve una lista vacía, no un error', async () => {
    const { result } = await renderMatches();

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('carga mientras la lectura está en vuelo', async () => {
    // Con el mock la promesa resuelve al instante, así que la lectura se
    // retiene a mano: es la única forma de ver el estado intermedio.
    let release: (matches: MatchWithProfile[]) => void = () => {};
    repositories = {
      ...repositories,
      matches: {
        ...repositories.matches,
        list: jest.fn(
          () =>
            new Promise<MatchWithProfile[]>((resolve) => {
              release = resolve;
            })
        ),
      },
    };

    const { result } = await renderHook(() => useMatches(), { wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await act(async () => {
      release([]);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([]);
  });

  it('resuelve el perfil del otro lado de cada match', async () => {
    await createMatch(SEED_RECIPROCAL_IDS[0]);
    const { result } = await renderMatches();

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].counterpart.id).toBe(SEED_RECIPROCAL_IDS[0]);
    expect(result.current.data![0].lastMessage).toBeNull();
  });

  it('un match nuevo entra en la lista sin remontar', async () => {
    const { result } = await renderMatches();
    expect(result.current.data).toEqual([]);

    await act(async () => {
      await createMatch(SEED_RECIPROCAL_IDS[0]);
    });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
  });

  it('un mensaje nuevo sube su match al principio de la lista', async () => {
    const first = await createMatch(SEED_RECIPROCAL_IDS[0]);
    await createMatch(SEED_RECIPROCAL_IDS[1]);

    const { result } = await renderMatches();
    const initialOrder = result.current.data!.map((match) => match.id);
    expect(initialOrder).toHaveLength(2);

    await act(async () => {
      await repositories.messages.send({ matchId: first, body: 'Hola' });
    });

    await waitFor(() => expect(result.current.data![0].id).toBe(first));
    expect(result.current.data![0].lastMessage!.body).toBe('Hola');
  });

  it('deja de escuchar al desmontarse', async () => {
    const list = jest.spyOn(repositories.matches, 'list');
    const { unmount } = await renderMatches();
    const callsWhileMounted = list.mock.calls.length;

    await act(async () => {
      unmount();
    });
    await createMatch(SEED_RECIPROCAL_IDS[0]);

    expect(list).toHaveBeenCalledTimes(callsWhileMounted);
  });

  it('expone el error si la lectura falla', async () => {
    const failure = new Error('Sin conexión.');
    repositories = {
      ...repositories,
      matches: {
        ...repositories.matches,
        list: jest.fn().mockRejectedValue(failure),
      },
    };

    const { result } = await renderMatches();

    expect(result.current.error).toBe(failure);
    expect(result.current.data).toBeNull();
  });

  it('refresh vuelve a pedir la lista', async () => {
    const list = jest.spyOn(repositories.matches, 'list');
    const { result } = await renderMatches();
    const before = list.mock.calls.length;

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(before));
  });
});
