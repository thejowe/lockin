/**
 * Tests de la ruta `/premium` (el paywall): lo que importa es que `openPaywall()`
 * aterrice en algo que navega sin error y de lo que se sale con «Ahora no».
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, screen } from '@testing-library/react-native';

import { openPaywall } from '@/features/premium';

import { renderRoute, resetRepositories, resetRouter, router, setSearchParams } from '../routes';

import PremiumRoute from '../../src/app/premium';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

beforeEach(() => {
  resetRepositories();
  resetRouter();
  setSearchParams({});
});

describe('PremiumRoute', () => {
  it('pinta el paywall con los planes de la oferta', async () => {
    await renderRoute(<PremiumRoute />);

    expect(await screen.findByText('Likes sin límite')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Mensual/ })).toBeTruthy();
  });

  it('«Ahora no» regresa a la pantalla anterior', async () => {
    await renderRoute(<PremiumRoute />);

    await screen.findByText('Likes sin límite');
    await fireEvent.press(screen.getByRole('button', { name: 'Ahora no' }));

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('abierta sin historial (enlace directo), «Ahora no» lleva a la puerta de entrada', async () => {
    router.canGoBack.mockReturnValue(false);
    await renderRoute(<PremiumRoute />);

    await screen.findByText('Likes sin límite');
    await fireEvent.press(screen.getByRole('button', { name: 'Ahora no' }));

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

it('abre los planes desde la posición del diamante y permite consultar la privacidad', async () => {
  const origin = { x: 150, y: 300, size: 42 };
  openPaywall({ origin });
  const params = { ox: '150', oy: '300', os: '42' };
  expect(router.push).toHaveBeenCalledWith({ pathname: '/premium', params });
  setSearchParams(params);
  await renderRoute(<PremiumRoute />);
  await screen.findByText('Likes sin límite');
  await fireEvent.press(screen.getByText('Política de privacidad'));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: '/legal/[doc]',
    params: { doc: 'privacy' },
  });
});
