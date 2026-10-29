/**
 * Tests de «Continuar con» + Google / Apple.
 *
 * Lo que no puede fallar en silencio:
 *
 * - que volver del proveedor avise a quien monta el botón, tenga la persona
 *   cuenta o no: es GoTrue quien abre la suya o crea una, y `/` decide después,
 * - que cerrar la hoja del proveedor no cuente como entrar,
 * - y que un fallo se quede aquí y se cuente.
 *
 * `enabledAuthProviders` y `accountsAvailable` se fijan con dobles: en Jest no
 * hay `EXPO_PUBLIC_AUTH_PROVIDERS` ni credenciales.
 */

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { DataProvider } from '@/data';
import { createMockRepositories, resetState } from '@/data/mock';

import { ProviderButtons } from './provider-buttons';

import type { Repositories } from '@/data';

jest.mock('./account-gateway', () => ({
  ...jest.requireActual('./account-gateway'),
  accountsAvailable: true,
  enabledAuthProviders: new Set(['google', 'apple']),
  signInWithProvider: jest.fn(),
}));

const gateway = jest.requireMock('./account-gateway') as { signInWithProvider: jest.Mock };

const onSignedIn = jest.fn();
let repositories: Repositories;
const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  resetState();
  repositories = createMockRepositories();
  Platform.OS = 'ios';
});

afterAll(() => {
  Platform.OS = originalOS;
});

async function renderButtons() {
  return render(
    <DataProvider value={repositories}>
      <ProviderButtons onSignedIn={onSignedIn} />
    </DataProvider>
  );
}

async function press(label: string) {
  await act(async () => {
    await fireEvent.press(screen.getByLabelText(label));
  });
}

it('ofrece Google y, en iOS, Apple', async () => {
  await renderButtons();
  expect(screen.getByLabelText('Continuar con Google')).toBeTruthy();
  expect(screen.getByLabelText('Continuar con Apple')).toBeTruthy();
});

it('en Android no ofrece Apple', async () => {
  Platform.OS = 'android';
  await renderButtons();
  expect(screen.getByLabelText('Continuar con Google')).toBeTruthy();
  expect(screen.queryByLabelText('Continuar con Apple')).toBeNull();
});

it('al volver del proveedor sigue adelante, sea cuenta nueva o de siempre', async () => {
  gateway.signInWithProvider.mockResolvedValue(true);
  await renderButtons();
  await press('Continuar con Google');
  expect(gateway.signInWithProvider).toHaveBeenCalledWith('google');
  expect(onSignedIn).toHaveBeenCalledTimes(1);
});

it('cerrar la hoja del proveedor no cuenta como entrar', async () => {
  gateway.signInWithProvider.mockResolvedValue(false);
  await renderButtons();
  await press('Continuar con Apple');
  expect(onSignedIn).not.toHaveBeenCalled();
});

it('un fallo se queda aquí y se cuenta', async () => {
  gateway.signInWithProvider.mockRejectedValue(new TypeError('Network request failed'));
  await renderButtons();
  await press('Continuar con Google');
  expect(onSignedIn).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toBeTruthy();
});
