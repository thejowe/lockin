/**
 * Tests de la ruta «Crear cuenta» y de la puerta que manda a ella.
 *
 * El formulario tiene sus propios tests en `src/features/profile/`. Aquí se
 * comprueba lo que saben las rutas, que es lo que la decisión del 2026-09-20
 * —el registro es **obligatorio**— exige que no se rompa:
 *
 * - que `mode` no se enseña a quien no tiene la cuenta confirmada, y manda a
 *   `/register`; y que la deja pasar en cuanto la tiene,
 * - que si no se puede comprobar la cuenta no se deja pasar (fallar abierto
 *   sería el fallo que la regla existe para evitar),
 * - que sin capa de cuentas (mock) o con la puerta apagada no hay puerta, y la
 *   pantalla de registro devuelve al principio,
 * - que al terminar el onboarding sigue por `/mode` con `replace`, y que
 *   «Ya tengo cuenta» abre el formulario de entrar con `push`.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderRoute, resetRepositories, resetRouter, router } from '../routes';

import ModeScreen from '../../src/app/(onboarding)/mode';
import RegisterScreen from '../../src/app/(onboarding)/register';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

let mockRequired = true;
const mockReadAccountState = jest.fn();
const mockLink = jest.fn();
const mockSetPassword = jest.fn();

// Las constantes del puente se fijan al cargar el módulo; aquí tienen que poder
// cambiar de un test a otro, y un getter dentro del literal no vale: Babel copia
// el valor al expandir el `...`. Por eso se definen después.
jest.mock('@/features/profile/account-gateway', () => {
  const mock = {
    ...jest.requireActual('@/features/profile/account-gateway'),
    readAccountState: () => mockReadAccountState(),
    linkEmailToCurrentUser: (...args: unknown[]) => mockLink(...args),
    setAccountPassword: (...args: unknown[]) => mockSetPassword(...args),
  };
  Object.defineProperty(mock, 'registrationRequired', { get: () => mockRequired });
  Object.defineProperty(mock, 'accountsAvailable', { get: () => mockRequired });
  return mock;
});

const ANONIMA = {
  kind: 'anonymous',
  userId: 'uid-1',
  email: null,
  pendingEmail: null,
  recoverable: false,
};

const CONFIRMADA = {
  kind: 'email',
  userId: 'uid-1',
  email: 'ana@example.com',
  pendingEmail: null,
  recoverable: true,
};

beforeEach(() => {
  resetRepositories();
  resetRouter();
  mockRequired = true;
  mockReadAccountState.mockReset().mockResolvedValue(ANONIMA);
  mockLink.mockReset().mockResolvedValue(undefined);
  mockSetPassword.mockReset().mockResolvedValue(undefined);
});

describe('la puerta en «¿Qué buscas?»', () => {
  it('sin la cuenta confirmada manda a /register y no enseña el paso', async () => {
    await renderRoute(<ModeScreen />);

    await waitFor(() => expect(router.redirects).toEqual(['/register']));
    expect(screen.queryByText('¿Qué buscas?')).toBeNull();
  });

  it('con una cuenta pendiente de confirmar tampoco pasa', async () => {
    mockReadAccountState.mockResolvedValue({
      ...ANONIMA,
      kind: 'pending-email',
      pendingEmail: 'ana@example.com',
    });

    await renderRoute(<ModeScreen />);

    await waitFor(() => expect(router.redirects).toEqual(['/register']));
  });

  it('con el email confirmado deja pasar', async () => {
    mockReadAccountState.mockResolvedValue(CONFIRMADA);

    await renderRoute(<ModeScreen />);

    expect(await screen.findByText('¿Qué buscas?')).toBeTruthy();
    expect(router.redirects).toEqual([]);
  });

  it('mientras lee la cuenta no enseña el paso ni redirige: no parpadea', async () => {
    mockReadAccountState.mockReturnValue(new Promise(() => {}));

    await renderRoute(<ModeScreen />);

    expect(screen.queryByText('¿Qué buscas?')).toBeNull();
    expect(router.redirects).toEqual([]);
  });

  it('si no se puede leer la cuenta no deja pasar: falla cerrado', async () => {
    mockReadAccountState.mockRejectedValue(new Error('Sin conexión.'));

    await renderRoute(<ModeScreen />);

    await waitFor(() => expect(router.redirects).toEqual(['/register']));
    expect(screen.queryByText('¿Qué buscas?')).toBeNull();
  });

  it('sin capa de cuentas (mock) o con la puerta apagada no hay puerta', async () => {
    mockRequired = false;

    await renderRoute(<ModeScreen />);

    expect(screen.getByText('¿Qué buscas?')).toBeTruthy();
    expect(router.redirects).toEqual([]);
  });
});

describe('RegisterScreen', () => {
  it('sin capa de cuentas vuelve al principio en vez de pintar el formulario', async () => {
    mockRequired = false;

    await renderRoute(<RegisterScreen />);

    expect(router.redirects).toEqual(['/mode']);
    expect(screen.queryByLabelText('Email de tu cuenta')).toBeNull();
  });

  it('pinta el registro para quien todavía no tiene cuenta', async () => {
    await renderRoute(<RegisterScreen />);

    expect(await screen.findByText('Crea tu cuenta')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeTruthy();
    expect(screen.queryByText(/ahora no/i)).toBeNull();
  });

  it('«Ya tengo cuenta» abre la entrada con push: desde ahí se puede volver', async () => {
    await renderRoute(<RegisterScreen />);
    await screen.findByText('Crea tu cuenta');

    await fireEvent.press(screen.getByRole('button', { name: 'Ya tengo cuenta' }));

    expect(router.push).toHaveBeenCalledWith('/sign-in');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('al elegir la contraseña sigue el onboarding por /mode con replace', async () => {
    mockReadAccountState.mockResolvedValue(CONFIRMADA);
    await renderRoute(<RegisterScreen />);
    await screen.findByText('Elige tu contraseña');

    await fireEvent.changeText(screen.getByLabelText('Contraseña de tu cuenta'), 'secreta-123');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar y continuar' }));
    await act(async () => {});

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/mode'));
    expect(mockSetPassword).toHaveBeenCalledWith('secreta-123');
    expect(router.push).not.toHaveBeenCalled();
  });
});
