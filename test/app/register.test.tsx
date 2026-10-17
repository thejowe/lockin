/**
 * Tests de la ruta «Crear cuenta» y de la puerta que manda a ella.
 *
 * El formulario tiene sus propios tests en `src/features/profile/`. Aquí se
 * comprueba lo que saben las rutas, que es lo que la decisión del 2026-09-20
 * —el registro es **obligatorio**— exige que no se rompa:
 *
 * - que la bienvenida (`mode`) es la entrada del alta para quien no tiene la
 *   cuenta confirmada, y que quien ya la tiene salta directo al formulario,
 * - que si no se puede comprobar la cuenta no se salta nada (fallar abierto
 *   sería el fallo que la regla existe para evitar),
 * - que sin capa de cuentas (mock) o con la puerta apagada no hay puerta, y la
 *   pantalla de registro devuelve al principio,
 * - que al terminar el registro vuelve a `/` con `replace` (que decide `/profile-form` o `/discover`), y que
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

describe('la bienvenida y la puerta', () => {
  // Desde el 2026-10-17 la bienvenida es la entrada del alta: se enseña a quien
  // aún no tiene cuenta (empieza por «Sobre ti») y solo se salta a quien ya la
  // tiene confirmada, que va directo al formulario.
  it('sin la cuenta confirmada enseña la bienvenida, con sus dos salidas', async () => {
    await renderRoute(<ModeScreen />);

    expect(await screen.findByRole('button', { name: 'Registrarse' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeTruthy();
    expect(router.redirects).toEqual([]);
  });

  it('con una cuenta pendiente de confirmar también: el alta sigue desde «Registrarse»', async () => {
    mockReadAccountState.mockResolvedValue({
      ...ANONIMA,
      kind: 'pending-email',
      pendingEmail: 'ana@example.com',
    });

    await renderRoute(<ModeScreen />);

    expect(await screen.findByRole('button', { name: 'Registrarse' })).toBeTruthy();
    expect(router.redirects).toEqual([]);
  });

  it('con el email confirmado y sin perfil, directo al formulario', async () => {
    mockReadAccountState.mockResolvedValue(CONFIRMADA);

    await renderRoute(<ModeScreen />);

    await waitFor(() => expect(router.redirects).toEqual(['/profile-form']));
    expect(screen.queryByRole('button', { name: 'Registrarse' })).toBeNull();
  });

  it('mientras lee la cuenta no enseña nada ni redirige: no parpadea', async () => {
    mockReadAccountState.mockReturnValue(new Promise(() => {}));

    await renderRoute(<ModeScreen />);

    expect(screen.queryByRole('button', { name: 'Registrarse' })).toBeNull();
    expect(router.redirects).toEqual([]);
  });

  it('si no se puede leer la cuenta no salta al formulario: falla cerrado', async () => {
    mockReadAccountState.mockRejectedValue(new Error('Sin conexión.'));

    await renderRoute(<ModeScreen />);

    expect(await screen.findByRole('button', { name: 'Registrarse' })).toBeTruthy();
    expect(router.redirects).toEqual([]);
  });

  it('sin capa de cuentas (mock) o con la puerta apagada no hay puerta', async () => {
    mockRequired = false;

    await renderRoute(<ModeScreen />);

    expect(screen.getByRole('button', { name: 'Registrarse' })).toBeTruthy();
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

  it('al elegir la contraseña vuelve a / con replace, que decide el destino', async () => {
    mockReadAccountState.mockResolvedValue(CONFIRMADA);
    await renderRoute(<RegisterScreen />);
    await screen.findByText('Elige tu contraseña');

    await fireEvent.changeText(screen.getByLabelText('Contraseña de tu cuenta'), 'secreta-123');
    await fireEvent.changeText(screen.getByLabelText('Repite la contraseña'), 'secreta-123');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar y continuar' }));
    await act(async () => {});

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(mockSetPassword).toHaveBeenCalledWith('secreta-123');
    expect(router.push).not.toHaveBeenCalled();
  });
});
