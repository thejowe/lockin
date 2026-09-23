/**
 * Tests de la ruta «Ya tengo cuenta» y del enlace que lleva a ella.
 *
 * El formulario tiene sus propios tests en `src/features/profile/`. Aquí se
 * comprueba lo que sabe la ruta:
 *
 * - que el enlace del paso 1 solo existe si hay capa de cuentas: sin
 *   credenciales de Supabase no hay servidor al que entrar,
 * - que la pantalla, si alguien llega sin capa de cuentas, vuelve al principio,
 * - y que al entrar se va a la puerta de entrada (`/`) con `replace`, que es
 *   quien relee `session:onboarded` y decide entre tabs y onboarding.
 *
 * Y un recorrido entero —el formulario de verdad más la puerta de entrada de
 * verdad— para el criterio de que no se ve nada de la cuenta anterior: la
 * sesión cambia bajo los repositorios y lo que pinta la puerta de entrada es
 * lo de la cuenta nueva.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { buildProfileInput } from '@/data/test-fixtures';
import { AccountError } from '@/features/profile/account-gateway';

import { renderRoute, repositories, resetRepositories, resetRouter, router } from '../routes';

import IndexRoute from '../../src/app/index';
import ModeScreen from '../../src/app/(onboarding)/mode';
import SignInScreen from '../../src/app/(onboarding)/sign-in';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

let mockAvailable = true;
const mockSignIn = jest.fn();
const mockReadAccountState = jest.fn();

// `accountsAvailable` es una constante que se fija al cargar el módulo; aquí tiene
// que poder cambiar de un test a otro, y un getter dentro del literal no vale:
// Babel copia el valor al expandir el `...`. Por eso se define después.
jest.mock('@/features/profile/account-gateway', () => {
  const mock = {
    ...jest.requireActual('@/features/profile/account-gateway'),
    signInWithEmail: (...args: unknown[]) => mockSignIn(...args),
    readAccountState: () => mockReadAccountState(),
  };
  Object.defineProperty(mock, 'accountsAvailable', { get: () => mockAvailable });
  return mock;
});

beforeEach(() => {
  resetRepositories();
  resetRouter();
  mockAvailable = true;
  mockSignIn.mockReset().mockResolvedValue('uid-2');
  mockReadAccountState.mockReset().mockResolvedValue(null);
});

describe('enlace «Ya tengo cuenta» del paso 1', () => {
  it('con capa de cuentas lo ofrece y lleva al formulario', async () => {
    await renderRoute(<ModeScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Ya tengo cuenta' }));

    expect(router.push).toHaveBeenCalledWith('/sign-in');
  });

  it('sin credenciales de Supabase no existe', async () => {
    mockAvailable = false;

    await renderRoute(<ModeScreen />);

    expect(screen.getByText('¿Qué buscas?')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ya tengo cuenta' })).toBeNull();
  });

  it('no es un muro: el onboarding sigue pudiéndose completar sin pulsarlo', async () => {
    await renderRoute(<ModeScreen />);

    await fireEvent.press(screen.getByText('Cofundador'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/profile-form'));
  });
});

describe('SignInScreen', () => {
  it('sin capa de cuentas vuelve al principio en vez de pintar el formulario', async () => {
    mockAvailable = false;

    await renderRoute(<SignInScreen />);

    expect(router.redirects).toEqual(['/mode']);
    expect(screen.queryByLabelText('Email de tu cuenta')).toBeNull();
  });

  it('al entrar sustituye la ruta por la puerta de entrada', async () => {
    await renderRoute(<SignInScreen />);

    await fireEvent.changeText(screen.getByLabelText('Email de tu cuenta'), 'ana@example.com');
    await fireEvent.changeText(screen.getByLabelText('Contraseña de tu cuenta'), 'secreta-123');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('con credenciales erróneas no navega', async () => {
    // El texto exacto lo fija `src/features/profile/account-copy.test.ts`; aquí
    // lo único que importa es que el fallo se vea y la ruta no cambie.
    mockSignIn.mockRejectedValue(
      new AccountError('unknown', 'Invalid login credentials', { code: 'invalid_credentials' })
    );
    await renderRoute(<SignInScreen />);

    await fireEvent.changeText(screen.getByLabelText('Email de tu cuenta'), 'ana@example.com');
    await fireEvent.changeText(screen.getByLabelText('Contraseña de tu cuenta'), 'mala');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText(/Email o contraseña incorrectos/)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('«Volver» retrocede sin cambiar de cuenta', async () => {
    await renderRoute(<SignInScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));

    expect(router.back).toHaveBeenCalled();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('el aviso de perfil sin email sale de la cuenta actual, no de otra caché', async () => {
    await repositories.session.setActiveMode('par');
    await repositories.profiles.saveCurrent(buildProfileInput());
    mockReadAccountState.mockResolvedValue({
      kind: 'anonymous',
      userId: 'uid-1',
      email: null,
      pendingEmail: null,
      recoverable: false,
    });
    await renderRoute(<SignInScreen />);

    await fireEvent.changeText(screen.getByLabelText('Email de tu cuenta'), 'ana@example.com');
    await fireEvent.changeText(screen.getByLabelText('Contraseña de tu cuenta'), 'secreta-123');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    await act(async () => {});

    expect(screen.getByText('Entrar aquí deja atrás el perfil de este teléfono')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('después de entrar: no queda nada de la cuenta anterior', () => {
  it('la puerta de entrada relee la sesión y manda a las tabs si la cuenta nueva tiene perfil', async () => {
    // La sesión es la de un dispositivo recién instalado: sin perfil.
    const first = await renderRoute(<IndexRoute />);
    await waitFor(() => expect(router.redirects).toEqual(['/mode']));
    await first.unmount();

    // Entrar cambia de cuenta: bajo los mismos repositorios ahora hay un perfil.
    await repositories.session.setActiveMode('par');
    await repositories.profiles.saveCurrent(buildProfileInput());
    resetRouter();

    // `replace('/')` monta la puerta de entrada de nuevo: no arrastra el
    // «sin perfil» de antes, porque la caché de `useQuery` muere con la pantalla.
    await renderRoute(<IndexRoute />);
    await waitFor(() => expect(router.redirects).toEqual(['/discover']));
  });

  it('y al onboarding si la cuenta nueva no tiene perfil', async () => {
    await repositories.session.setActiveMode('par');
    await repositories.profiles.saveCurrent(buildProfileInput());

    const first = await renderRoute(<IndexRoute />);
    await waitFor(() => expect(router.redirects).toEqual(['/discover']));
    await first.unmount();

    // Cuenta nueva y vacía: el mock se reinicia para simular otro `auth.uid()`.
    resetRepositories();
    resetRouter();

    await renderRoute(<IndexRoute />);
    await waitFor(() => expect(router.redirects).toEqual(['/mode']));
  });
});
