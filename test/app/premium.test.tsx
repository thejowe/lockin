/**
 * Tests de la ruta `/premium`, que hasta la Tarea 9 del plan de Premium es un
 * stub: dice que llega pronto y deja volver. Lo único que importa es que
 * `openPaywall()` aterrice en algo que navega sin error y de lo que se sale.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, screen } from '@testing-library/react-native';

import { openPaywall } from '@/features/premium';

import { renderRoute, resetRepositories, resetRouter, router } from '../routes';

import PremiumRoute from '../../src/app/premium';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

beforeEach(() => {
  resetRepositories();
  resetRouter();
});

describe('PremiumRoute (stub)', () => {
  it('dice que Premium llega pronto, sin prometer precios', async () => {
    await renderRoute(<PremiumRoute />);

    expect(screen.getByText('Muy pronto')).toBeTruthy();
    expect(screen.queryByText(/€/)).toBeNull();
  });

  it('Volver regresa a la pantalla anterior', async () => {
    await renderRoute(<PremiumRoute />);

    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('abierta sin historial (enlace directo), Volver lleva a la puerta de entrada', async () => {
    router.canGoBack.mockReturnValue(false);
    await renderRoute(<PremiumRoute />);

    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));

    expect(router.replace).toHaveBeenCalledWith('/');
    expect(router.back).not.toHaveBeenCalled();
  });
});

describe('openPaywall', () => {
  it('navega a /premium', () => {
    openPaywall();

    expect(router.push).toHaveBeenCalledWith('/premium');
  });
});
