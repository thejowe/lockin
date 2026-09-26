import { act, renderHook, waitFor } from '@testing-library/react-native';

import { DataProvider } from '@/data';
import { createMockAgreementRepository, createMockRepositories, resetState } from '@/data/mock';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';
import { buildProfileInput } from '@/data/test-fixtures';

import { useAgreement } from './use-agreement';

import type { Repositories } from '@/data';

let focus: (() => void) | null = null;
jest.mock('expo-router', () => ({
  // El primer foco es el montaje; el test llama a `focus()` para simular volver.
  useFocusEffect: (effect: () => void) => {
    const react = jest.requireActual('react');
    react.useEffect(() => {
      focus = effect;
      effect();
    }, [effect]);
  },
}));

const NURIA = SEED_RECIPROCAL_IDS[0];
let repositories: Repositories;
let matchId: string;

beforeEach(async () => {
  resetState();
  repositories = createMockRepositories();
  await repositories.profiles.saveCurrent(buildProfileInput({ lookingFor: 'par' }));
  const { match } = await repositories.discovery.recordDecision(NURIA, 'like');
  expect(match?.mode).toBe('par');
  matchId = match!.id;
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <DataProvider value={repositories}>{children}</DataProvider>
);

it('lee la vista con la semilla de Núria oculta', async () => {
  const { result } = await renderHook(() => useAgreement(matchId), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.views.find((view) => view.topic === 'dedicacion')?.theirs).toBe('hidden');
});

it('responder relee y revela', async () => {
  const { result } = await renderHook(() => useAgreement(matchId), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));

  await act(async () => {
    await result.current.answer('dedicacion', 'completa', null);
  });

  await waitFor(() =>
    expect(result.current.views.find((view) => view.topic === 'dedicacion')?.theirs).toMatchObject({
      option: 'completa',
    })
  );
});

it('un doble toque escribe una sola vez', async () => {
  const spy = jest.spyOn(repositories.agreement, 'answer');
  const { result } = await renderHook(() => useAgreement(matchId), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));

  let results: boolean[] = [];
  await act(async () => {
    results = await Promise.all([
      result.current.answer('horizonte', '1-ano', null),
      result.current.answer('horizonte', '3-meses', null),
    ]);
  });

  expect(spy).toHaveBeenCalledTimes(1);
  expect(results).toEqual([true, false]);
});

it('al volver a enfocar relee: ve el cambio del otro', async () => {
  const { result } = await renderHook(() => useAgreement(matchId), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.answer('horizonte', '1-ano', null);
  });
  await createMockAgreementRepository(NURIA).answer({
    matchId,
    topic: 'horizonte',
    option: '3-meses',
  });

  await act(async () => focus?.());

  await waitFor(() =>
    expect(result.current.views.find((view) => view.topic === 'horizonte')?.theirs).toMatchObject({
      option: '3-meses',
    })
  );
});

it('un fallo al guardar queda en saveError y devuelve false', async () => {
  jest.spyOn(repositories.agreement, 'answer').mockRejectedValueOnce(new Error('sin red'));
  const { result } = await renderHook(() => useAgreement(matchId), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));

  let ok = true;
  await act(async () => {
    ok = await result.current.answer('horizonte', '1-ano', null);
  });

  expect(ok).toBe(false);
  expect(result.current.saveError?.message).toBe('sin red');
});
