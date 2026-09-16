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
