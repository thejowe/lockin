/**
 * «Continuar con Google / Apple» en la bienvenida (2026-10-17).
 *
 * - Solo salen con el proveedor configurado en la compilación.
 * - Al volver se guarda el modo en la sesión NUEVA (la del proveedor) y se va a
 *   `/`, que decide entre formulario y deck.
 * - Cancelar no navega; un fallo se cuenta.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderRoute, repositories, resetRepositories, resetRouter, router } from '../routes';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

const mockSignIn = jest.fn();

jest.mock('@/features/profile/account-gateway', () => ({
  ...jest.requireActual('@/features/profile/account-gateway'),
  accountsAvailable: true,
  registrationRequired: false,
  enabledAuthProviders: new Set(['google', 'apple']),
  signInWithProvider: (...args: unknown[]) => mockSignIn(...args),
}));

// Importado después del mock: las constantes de la pantalla se fijan al cargar.
const ModeScreen = require('../../src/app/(onboarding)/mode').default;

beforeEach(() => {
  resetRepositories();
  resetRouter();
  mockSignIn.mockReset().mockResolvedValue(true);
});

it('ofrece Google y, al volver, guarda el modo y deja decidir a la puerta de entrada', async () => {
  await renderRoute(<ModeScreen />);

  await fireEvent.press(screen.getByRole('button', { name: 'Continuar con Google' }));

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  expect(mockSignIn).toHaveBeenCalledWith('google');
  await expect(repositories.session.get()).resolves.toMatchObject({ activeMode: 'par' });
});

it('si se cancela no navega', async () => {
  mockSignIn.mockResolvedValue(false);
  await renderRoute(<ModeScreen />);

  await fireEvent.press(screen.getByRole('button', { name: 'Continuar con Google' }));

  await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
  expect(router.replace).not.toHaveBeenCalled();
});

it('un fallo se cuenta en la pantalla', async () => {
  mockSignIn.mockRejectedValue(new Error('provider is not enabled'));
  await renderRoute(<ModeScreen />);

  await fireEvent.press(screen.getByRole('button', { name: 'Continuar con Google' }));

  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();
});

it('Apple sale en iOS (el preset `jest-expo` corre como iOS)', async () => {
  const { Platform } = require('react-native');
  expect(Platform.OS).toBe('ios');
  await renderRoute(<ModeScreen />);

  expect(screen.getByRole('button', { name: 'Continuar con Apple' })).toBeTruthy();
});
