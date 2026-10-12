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

// La puerta del correo: por defecto abierta (mock sin capa de cuentas); un test
// la cierra para simular una cuenta anónima anterior al registro obligatorio.
let mockRequired = false;
const mockReadAccountState = jest.fn();

jest.mock('@/features/profile/account-gateway', () => {
  const mock = {
    ...jest.requireActual('@/features/profile/account-gateway'),
    readAccountState: () => mockReadAccountState(),
  };
  Object.defineProperty(mock, 'registrationRequired', { get: () => mockRequired });
  Object.defineProperty(mock, 'accountsAvailable', { get: () => mockRequired });
  return mock;
});

const ANONIMA = { kind: 'anonymous', userId: 'u', email: null, pendingEmail: null, recoverable: false };
const CONFIRMADA = { ...ANONIMA, kind: 'email', email: 'ana@example.com', recoverable: true };

beforeEach(() => {
  resetRepositories();
  resetRouter();
  mockRequired = false;
  mockReadAccountState.mockReset().mockResolvedValue(CONFIRMADA);
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

describe('IndexRoute con la puerta del correo', () => {
  beforeEach(async () => {
    mockRequired = true;
    await repositories.session.setActiveMode('par');
    await repositories.profiles.saveCurrent(buildProfileInput());
  });

  it('con perfil de antes y sin email confirmado manda a /register, no al deck', async () => {
    mockReadAccountState.mockResolvedValue(ANONIMA);

    await renderRoute(<IndexRoute />);

    await waitFor(() => expect(router.redirects).toEqual(['/register']));
  });

  it('con perfil y email confirmado entra al deck', async () => {
    mockReadAccountState.mockResolvedValue(CONFIRMADA);

    await renderRoute(<IndexRoute />);

    await waitFor(() => expect(router.redirects).toEqual(['/discover']));
  });

  it('si no se puede leer la cuenta no abre el deck: falla cerrado', async () => {
    mockReadAccountState.mockRejectedValue(new Error('Sin conexión.'));

    await renderRoute(<IndexRoute />);

    await waitFor(() => expect(router.redirects).toEqual(['/register']));
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
