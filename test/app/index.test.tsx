/**
 * Tests de la puerta de entrada.
 *
 * No pinta nada: solo decide a dónde va la app al abrirse. Equivocarse manda a
 * alguien con perfil de vuelta al onboarding, o a alguien sin perfil a un deck
 * que no puede usar — y ninguna de las dos cosas se ve en un test de otra
 *
 * Ojo: en RNTL 14 `render` es asíncrono.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { buildProfileInput } from '@/data/test-fixtures';

import { renderRoute, repositories, resetRepositories, resetRouter, router } from '../routes';

import IndexRoute from '../../src/app/index';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

beforeEach(() => {
  resetRepositories();
  resetRouter();
});

describe('IndexRoute', () => {
  it('sin onboarding hecho manda al paso 1', async () => {
    await renderRoute(<IndexRoute />);

    await waitFor(() => expect(router.redirects).toEqual(['/mode']));
  });

  it('con perfil creado entra directamente al deck', async () => {
    await repositories.session.setActiveMode('par');
    await repositories.profiles.saveCurrent(buildProfileInput());

    await renderRoute(<IndexRoute />);

    await waitFor(() => expect(router.redirects).toEqual(['/discover']));
  });
});

it('un fallo de lectura no abre onboarding y permite reintentar', async () => {
  jest
    .spyOn(repositories.session, 'isOnboarded')
    .mockRejectedValueOnce(new Error('Sin conexión'))
    .mockResolvedValueOnce(true);
  await renderRoute(<IndexRoute />);
  expect(await screen.findByText('No hemos podido recuperar tu perfil')).toBeOnTheScreen();
  expect(router.redirects).toEqual([]);
  await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
  await waitFor(() => expect(router.redirects).toEqual(['/discover']));
});

it('enseña la causa del fallo: el texto fijo a secas no dejaba diagnosticar nada', async () => {
  // Esta pantalla es donde muere el arranque. Sin la causa escrita en ella, el
  // volcado de jerarquía que sube `E2E Android` no dice más que «algo falló», y
  // cada vuelta de CI cuesta 20 minutos sin traer información nueva
  // (run 35362453233).
  jest
    .spyOn(repositories.session, 'isOnboarded')
    .mockRejectedValue(new Error('permission denied for table profiles'));

  await renderRoute(<IndexRoute />);

  expect(await screen.findByText('permission denied for table profiles')).toBeOnTheScreen();
});
