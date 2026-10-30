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

// Sin tipos propios en el repo (no hay `@types/react-dom`): se pide por `requireActual`.
const { renderToString } = jest.requireActual<{
  renderToString: (element: React.ReactElement) => string;
}>('react-dom/server');

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

  it('no toca repositories.premium al renderizar: el export estático no tiene backend', () => {
    // `src/data/active.ts` lanza al primer uso real si faltan las credenciales, y
    // `expo export` renderiza las rutas sin ninguna. Solo valen efectos y callbacks.
    const premiumGetter = jest.fn(() => {
      throw new Error('cofounder no puede arrancar sin backend');
    });
    const guarded = { ...repositories };
    Object.defineProperty(guarded, 'premium', { get: premiumGetter });

    function Probe() {
      usePremium();
      return null;
    }

    expect(() =>
      renderToString(
        <DataProvider value={guarded as Repositories}>
          <Probe />
        </DataProvider>
      )
    ).not.toThrow();
    expect(premiumGetter).not.toHaveBeenCalled();
  });

  it('si los cupos no se pueden leer, deja de cargar sin romper', async () => {
    jest.spyOn(repositories.premium, 'getQuotas').mockRejectedValue(new Error('sin red'));

    const view = await renderHook(() => usePremium(), { wrapper });
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.quotas).toBeNull();

    await act(async () => {
      await view.result.current.refresh();
    });
    expect(view.result.current.quotas).toBeNull();
    expect(view.result.current.loading).toBe(false);
  });

  it('si se desmonta antes de que respondan los cupos, no actualiza nada', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const real = await repositories.premium.getQuotas();
    jest.spyOn(repositories.premium, 'getQuotas').mockImplementation(async () => {
      await gate;
      return real;
    });
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});

    const view = await renderHook(() => usePremium(), { wrapper });
    await view.unmount();
    await act(async () => release());

    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('un fallo de lectura tras desmontar tampoco actualiza nada', async () => {
    let fail: (reason: Error) => void = () => {};
    const gate = new Promise<never>((_resolve, reject) => (fail = reject));
    jest.spyOn(repositories.premium, 'getQuotas').mockReturnValue(gate);
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});

    const view = await renderHook(() => usePremium(), { wrapper });
    await view.unmount();
    await act(async () => fail(new Error('tarde')));

    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('un aviso que llega antes que la primera lectura gana a la lectura', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const stale = await repositories.premium.getQuotas();
    jest.spyOn(repositories.premium, 'getQuotas').mockImplementation(async () => {
      await gate;
      return stale;
    });
    let push: (quotas: typeof stale) => void = () => {};
    jest.spyOn(repositories.premium, 'subscribeQuotas').mockImplementation((cb) => {
      push = cb;
      return () => {};
    });

    const view = await renderHook(() => usePremium(), { wrapper });
    await act(async () => push({ ...stale, likesLeft: 7 }));
    await act(async () => release());

    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.quotas?.likesLeft).toBe(7);
  });
});
