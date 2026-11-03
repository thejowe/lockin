/**
 * `/legal/[doc]`: la hoja de un documento legal. Un documento desconocido (o
 * `constructor` desde la URL) vuelve a la puerta; el botón «Cerrar» vuelve atrás o,
 * sin pila, a la raíz.
 */

import { fireEvent, screen } from '@testing-library/react-native';

import { renderRoute, resetRepositories, resetRouter, router, setSearchParams } from '../routes';

import LegalRoute from '../../src/app/legal/[doc]';

let mockHeaderRight: (() => React.ReactElement) | undefined;

jest.mock('expo-router', () => {
  const base = require('../routes').expoRouterMock();
  function MockScreen({ options }: { options?: { headerRight?: () => React.ReactElement } }) {
    mockHeaderRight = options?.headerRight;
    return null;
  }
  base.Stack.Screen = MockScreen;
  return base;
});

beforeEach(() => {
  resetRepositories();
  resetRouter();
  mockHeaderRight = undefined;
});

describe('LegalRoute', () => {
  it('manda a la raíz un documento que no existe', async () => {
    setSearchParams({ doc: 'constructor' });

    await renderRoute(<LegalRoute />);

    expect(router.redirects).toEqual(['/']);
  });

  it('«Cerrar» vuelve atrás si hay pila', async () => {
    setSearchParams({ doc: 'terms' });
    await renderRoute(<LegalRoute />);

    await renderRoute(mockHeaderRight!());
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));

    expect(router.back).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('«Cerrar» sin pila (enlace directo) va a la raíz', async () => {
    router.canGoBack.mockReturnValue(false);
    setSearchParams({ doc: 'privacy' });
    await renderRoute(<LegalRoute />);

    await renderRoute(mockHeaderRight!());
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));

    expect(router.replace).toHaveBeenCalledWith('/');
  });
});
