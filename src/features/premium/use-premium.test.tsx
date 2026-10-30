/**
 * Tests de `usePremium`: los cupos de quien usa la app y las dos acciones de
 * pago (deshacer y Boost). Se prueba contra el mock, que aplica las mismas
 * reglas que el servidor, para que un cambio de cupo en otra parte de la app
 * llegue al hook por `subscribeQuotas` y no por una relectura a mano.
 *
 * Ojo: en RNTL 14 `renderHook` es asíncrono.
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';

import { DataProvider, PremiumRequiredError } from '@/data';
import { createMockRepositories, resetState, setMockPremium } from '@/data/mock';

import { usePremium } from './use-premium';

import type { Repositories } from '@/data';

let repositories: Repositories;

function wrapper({ children }: { children: React.ReactNode }) {
  return <DataProvider value={repositories}>{children}</DataProvider>;
}

async function renderPremium() {
  const view = await renderHook(() => usePremium(), { wrapper });
  await waitFor(() => expect(view.result.current.quotas).not.toBeNull());
  return view;
}

beforeEach(() => {
  resetState();
  repositories = createMockRepositories();
});

describe('usePremium', () => {
  it('mientras lee los cupos está cargando, y luego los trae', async () => {
    const real = repositories.premium.getQuotas();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    jest.spyOn(repositories.premium, 'getQuotas').mockImplementation(async () => {
      await gate;
      return real;
    });

    const view = await renderHook(() => usePremium(), { wrapper });
    expect(view.result.current.loading).toBe(true);
    expect(view.result.current.quotas).toBeNull();

    await act(async () => release());
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.quotas).toMatchObject({ isPremium: false, likesLeft: 25 });
  });

  it('se actualiza solo cuando cambian los cupos', async () => {
    const { result } = await renderPremium();
    expect(result.current.quotas!.likesLeft).toBe(25);

    await act(async () => {
      await repositories.discovery.recordDecision('seed-diego', 'like');
    });

    await waitFor(() => expect(result.current.quotas!.likesLeft).toBe(24));
  });

  it('refresh vuelve a leer los cupos', async () => {
    const { result } = await renderPremium();
    const getQuotas = jest.spyOn(repositories.premium, 'getQuotas');

    await act(async () => {
      await result.current.refresh();
    });

    expect(getQuotas).toHaveBeenCalledTimes(1);
  });

  it('sin Premium, deshacer rechaza PremiumRequiredError', async () => {
    const { result } = await renderPremium();

    await expect(result.current.undo()).rejects.toBeInstanceOf(PremiumRequiredError);
  });

  it('con Premium, deshacer devuelve el perfil que se había decidido', async () => {
    setMockPremium(true);
    const { result } = await renderPremium();
    await act(async () => {
      await repositories.discovery.recordDecision('seed-diego', 'pass');
    });

    await act(async () => {
      await expect(result.current.undo()).resolves.toBe('seed-diego');
    });
  });

  it('con Premium, el Boost devuelve cuándo termina y lo refleja en los cupos', async () => {
    setMockPremium(true);
    const { result } = await renderPremium();

    let endsAt = '';
    await act(async () => {
      endsAt = await result.current.boost();
    });

    expect(Number.isNaN(Date.parse(endsAt))).toBe(false);
    await waitFor(() => expect(result.current.quotas!.boostActiveUntil).toBe(endsAt));
  });

  it('sin Premium, el Boost rechaza PremiumRequiredError', async () => {
    const { result } = await renderPremium();

    await expect(result.current.boost()).rejects.toBeInstanceOf(PremiumRequiredError);
  });
});
