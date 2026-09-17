/**
 * Tests de la sección de cuenta del perfil propio.
 *
 * Lo que se prueba aquí es lo que el usuario no puede permitirse que falle:
 *
 * - que una cuenta irrecuperable lo diga, en vez de dejar creer que hay copia,
 * - que `pending-email` **no** se pinte como estado a salvo, porque todavía no
 *   lo es,
 * - que cerrar sesión desde una cuenta sin email no borre nada sin un aviso
 *   inequívoco de por medio — y que el aviso no lo decida esta pantalla, sino
 *   el `unrecoverable-account` que lanza la capa de datos,
 * - y que los errores del servidor se vean, con el mensaje ya traducido y sin
 *   ofrecer «entra en la otra cuenta» cuando el email está en uso.
 *
 * La capa de cuentas se sustituye por dobles: `account-gateway` es el único
 * archivo del bloque que habla con Supabase, así que mockearlo deja la sección
 * probándose contra estados concretos sin red ni credenciales. `AccountError`
 * viene del módulo real porque la sección lo usa con `instanceof`.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DataProvider } from '@/data';
import { createMockRepositories, resetState } from '@/data/mock';

import { AccountSection } from './account-section';

import type { AccountState } from './account-gateway';
import type { Repositories } from '@/data';

jest.mock('./account-gateway', () => ({
  ...jest.requireActual('./account-gateway'),
  readAccountState: jest.fn(),
  linkEmailToCurrentUser: jest.fn(),
  setAccountPassword: jest.fn(),
  sendPasswordReset: jest.fn(),
  signOut: jest.fn(),
}));

const gateway = jest.requireMock('./account-gateway') as {
  AccountError: typeof import('./account-gateway').AccountError;
  readAccountState: jest.Mock;
  linkEmailToCurrentUser: jest.Mock;
  setAccountPassword: jest.Mock;
  sendPasswordReset: jest.Mock;
  signOut: jest.Mock;
};

const { AccountError } = gateway;

/** Cuenta anónima: la que nace sola al abrir la app y no se puede recuperar. */
const ANONIMA: AccountState = {
  kind: 'anonymous',
  userId: 'uid-1',
  email: null,
  pendingEmail: null,
  recoverable: false,
};

/** Email pedido y todavía sin confirmar: sigue sin ser recuperable. */
const PENDIENTE: AccountState = {
  ...ANONIMA,
  kind: 'pending-email',
  pendingEmail: 'ana@example.com',
};

/** Cuenta asegurada: email confirmado y vuelta desde otro teléfono posible. */
const ASEGURADA: AccountState = {
  kind: 'email',
  userId: 'uid-1',
  email: 'ana@example.com',
  pendingEmail: null,
  recoverable: true,
};

let repositories: Repositories;

beforeEach(() => {
  jest.clearAllMocks();
  resetState();
  repositories = createMockRepositories();

  gateway.readAccountState.mockResolvedValue(ANONIMA);
  gateway.linkEmailToCurrentUser.mockResolvedValue(PENDIENTE);
  gateway.setAccountPassword.mockResolvedValue(undefined);
  gateway.sendPasswordReset.mockResolvedValue(undefined);
  gateway.signOut.mockResolvedValue(undefined);
});

/** Monta la sección tal y como la monta la tab Perfil. */
async function renderSection(state: AccountState | null = ANONIMA) {
  gateway.readAccountState.mockResolvedValue(state);

  return render(
    <DataProvider value={repositories}>
      <AccountSection />
    </DataProvider>
  );
}

/**
 * Pulsa un botón y espera a que se asiente la petición que dispara.
 *
 * Hace falta porque `run()` sigue tocando estado después del `await`: pone el
 * aviso y apaga el «ocupado». Sin este respiro esas actualizaciones caen fuera
 * de `act` y React las denuncia por consola, que es cómo un test verde acaba
 * tapando un render que nadie ha visto.
 */
async function press(name: string) {
  await fireEvent.press(screen.getByRole('button', { name }));
  await act(async () => {});
}

describe('AccountSection', () => {
  describe('cuenta sin email', () => {
    it('avisa de que los datos viven solo en este teléfono', async () => {
      await renderSection(ANONIMA);

      await waitFor(() =>
        expect(screen.getByText('Tus datos viven solo en este teléfono')).toBeTruthy()
      );
      expect(screen.getByText(/no hay forma de traerlos de vuelta/i)).toBeTruthy();
    });

    it('no habla de crear cuenta ni de registrarse: la cuenta ya existe', async () => {
      await renderSection(ANONIMA);

      await waitFor(() => expect(screen.getByText('Asegurar mi cuenta')).toBeTruthy());
      expect(screen.queryByText(/crear cuenta|reg[íi]strate|registrarte/i)).toBeNull();
      expect(screen.getByText(/aseguras la que ya tienes/i)).toBeTruthy();
    });

    it('el campo de email se anuncia solo, sin depender de la etiqueta visible', async () => {
      await renderSection(ANONIMA);

      await waitFor(() =>
        expect(screen.getByLabelText('Email con el que asegurar tu cuenta')).toBeTruthy()
      );
    });

    it('asegurar la cuenta manda el email tecleado, sin espacios de más', async () => {
      await renderSection(ANONIMA);
      await waitFor(() => expect(screen.getByText('Asegurar mi cuenta')).toBeTruthy());

      await fireEvent.changeText(
        screen.getByLabelText('Email con el que asegurar tu cuenta'),
        '  ana@example.com  '
      );
      await press('Asegurar mi cuenta');

      await waitFor(() =>
        expect(gateway.linkEmailToCurrentUser).toHaveBeenCalledWith('ana@example.com')
      );
    });

    it('con el email vacío no se llama al servidor: se dice qué falta', async () => {
      await renderSection(ANONIMA);
      await waitFor(() => expect(screen.getByText('Asegurar mi cuenta')).toBeTruthy());

      await press('Asegurar mi cuenta');

      await waitFor(() => expect(screen.getByText(/Escribe tu email/i)).toBeTruthy());
      expect(gateway.linkEmailToCurrentUser).not.toHaveBeenCalled();
    });
  });

  describe('email pedido y sin confirmar', () => {
    it('dice a qué correo, y no lo presenta como estado a salvo', async () => {
      await renderSection(PENDIENTE);

      await waitFor(() => expect(screen.getByText('Falta confirmar tu email')).toBeTruthy());
      expect(screen.getByText(/ana@example\.com/)).toBeTruthy();
      expect(screen.getByText(/siguen viviendo solo en este teléfono/i)).toBeTruthy();
      expect(screen.queryByText('Tu cuenta está asegurada')).toBeNull();
    });

    it('reenviar el correo vuelve a pedirlo para el mismo email', async () => {
      await renderSection(PENDIENTE);
      await waitFor(() => expect(screen.getByText('Reenviar el correo')).toBeTruthy());

      await press('Reenviar el correo');

      await waitFor(() =>
        expect(gateway.linkEmailToCurrentUser).toHaveBeenCalledWith('ana@example.com')
      );
      expect(screen.getByText('Te lo hemos vuelto a mandar.')).toBeTruthy();
    });

    it('se puede cambiar de email sin salir de aquí', async () => {
      await renderSection(PENDIENTE);
      await waitFor(() => expect(screen.getByText('Usar otro email')).toBeTruthy());

      await press('Usar otro email');

      expect(screen.getByLabelText('Email con el que asegurar tu cuenta')).toBeTruthy();
    });
  });

  describe('cuenta asegurada', () => {
    it('enseña el email y ofrece ponerle contraseña', async () => {
      await renderSection(ASEGURADA);

      await waitFor(() => expect(screen.getByText('Tu cuenta está asegurada')).toBeTruthy());
      expect(screen.getByLabelText('Email de tu cuenta: ana@example.com')).toBeTruthy();
      expect(screen.getByLabelText('Contraseña de tu cuenta')).toBeTruthy();
      expect(screen.queryByLabelText('Email con el que asegurar tu cuenta')).toBeNull();
    });

    it('con la contraseña vacía no se llama al servidor: se dice qué falta', async () => {
      await renderSection(ASEGURADA);
      await waitFor(() => expect(screen.getByText('Guardar contraseña')).toBeTruthy());

      await press('Guardar contraseña');

      await waitFor(() => expect(screen.getByText(/Escribe la contraseña/i)).toBeTruthy());
      expect(gateway.setAccountPassword).not.toHaveBeenCalled();
    });

    it('guardar la contraseña la manda y lo confirma', async () => {
      await renderSection(ASEGURADA);
      await waitFor(() => expect(screen.getByText('Guardar contraseña')).toBeTruthy());

      await fireEvent.changeText(
        screen.getByLabelText('Contraseña de tu cuenta'),
        'hola-que-tal-9'
      );
      await press('Guardar contraseña');

      await waitFor(() =>
        expect(gateway.setAccountPassword).toHaveBeenCalledWith('hola-que-tal-9')
      );
      expect(screen.getByText(/Contraseña guardada/i)).toBeTruthy();
    });

    it('recuperar la contraseña manda el correo a la dirección de la cuenta', async () => {
      await renderSection(ASEGURADA);
      await waitFor(() =>
        expect(screen.getByText('No me acuerdo: mándame un correo')).toBeTruthy()
      );

      await press('No me acuerdo: mándame un correo');

      await waitFor(() =>
        expect(gateway.sendPasswordReset).toHaveBeenCalledWith('ana@example.com')
      );
      expect(screen.getByText(/correo para cambiar la contraseña/i)).toBeTruthy();
    });

    it('cerrar sesión no pide confirmación: aquí no se pierde nada', async () => {
      await renderSection(ASEGURADA);
      await waitFor(() => expect(screen.getByText('Cerrar sesión')).toBeTruthy());

      await press('Cerrar sesión');

      await waitFor(() => expect(gateway.signOut).toHaveBeenCalledWith());
      expect(screen.queryByText('Cerrar sesión aquí borra tus datos')).toBeNull();
    });
  });

  describe('cerrar sesión desde una cuenta irrecuperable', () => {
    beforeEach(() => {
      // El bloqueo es de la capa de datos, no de la pantalla: `signOut()` sin
      // flag se niega, y la sección solo convierte esa negativa en aviso.
      gateway.signOut.mockImplementation((options?: { acceptDataLoss?: boolean }) =>
        options?.acceptDataLoss
          ? Promise.resolve()
          : Promise.reject(
              new AccountError(
                'unrecoverable-account',
                'Esta cuenta solo vive en este teléfono: cerrar sesión borraría tu perfil.'
              )
            )
      );
    });

    it('no borra nada al primer toque: avisa de lo que se va a perder', async () => {
      await renderSection(ANONIMA);
      await waitFor(() => expect(screen.getByText('Cerrar sesión')).toBeTruthy());

      await press('Cerrar sesión');

      await waitFor(() =>
        expect(screen.getByText('Cerrar sesión aquí borra tus datos')).toBeTruthy()
      );
      expect(screen.getByText(/desaparecen para siempre/i)).toBeTruthy();
      expect(gateway.signOut).toHaveBeenCalledTimes(1);
      expect(gateway.signOut).not.toHaveBeenCalledWith({ acceptDataLoss: true });
    });

    it('«mejor no» deja la cuenta intacta', async () => {
      await renderSection(ANONIMA);
      await waitFor(() => expect(screen.getByText('Cerrar sesión')).toBeTruthy());
      await press('Cerrar sesión');
      await waitFor(() =>
        expect(screen.getByText('Cerrar sesión aquí borra tus datos')).toBeTruthy()
      );

      await press('Mejor no');

      expect(screen.queryByText('Cerrar sesión aquí borra tus datos')).toBeNull();
      expect(gateway.signOut).toHaveBeenCalledTimes(1);
    });

    it('solo tras confirmarlo se pasa el flag que acepta la pérdida', async () => {
      await renderSection(ANONIMA);
      await waitFor(() => expect(screen.getByText('Cerrar sesión')).toBeTruthy());
      await press('Cerrar sesión');
      await waitFor(() =>
        expect(screen.getByText('Cerrar sesión aquí borra tus datos')).toBeTruthy()
      );

      await press('Borrarlo todo y cerrar sesión');

      await waitFor(() => expect(gateway.signOut).toHaveBeenCalledWith({ acceptDataLoss: true }));
    });
  });

  describe('errores', () => {
    it('el email ya en uso se ve, y no se ofrece entrar en la otra cuenta', async () => {
      gateway.linkEmailToCurrentUser.mockRejectedValue(
        new AccountError(
          'email-in-use',
          'Ese email ya tiene una cuenta de LockIn. Prueba con otro.'
        )
      );
      await renderSection(ANONIMA);
      await waitFor(() => expect(screen.getByText('Asegurar mi cuenta')).toBeTruthy());

      await fireEvent.changeText(
        screen.getByLabelText('Email con el que asegurar tu cuenta'),
        'ana@example.com'
      );
      await press('Asegurar mi cuenta');

      await waitFor(() =>
        expect(screen.getByText(/Ese email ya tiene una cuenta de LockIn/)).toBeTruthy()
      );
      expect(screen.queryByText(/entrar en (esa|la otra) cuenta/i)).toBeNull();
    });

    it('sin conexión se dice, y el fallo no es mudo', async () => {
      gateway.setAccountPassword.mockRejectedValue(
        new AccountError('offline', 'No hay conexión con el servidor. Inténtalo otra vez.')
      );
      await renderSection(ASEGURADA);
      await waitFor(() => expect(screen.getByText('Guardar contraseña')).toBeTruthy());

      await fireEvent.changeText(screen.getByLabelText('Contraseña de tu cuenta'), 'una-clave');
      await press('Guardar contraseña');

      await waitFor(() => expect(screen.getByText(/No hay conexión con el servidor/)).toBeTruthy());
    });

    it('un rechazo que no es un Error tampoco se queda mudo', async () => {
      // GoTrue siempre manda `Error`, pero un fallo de red del runtime puede
      // llegar como cualquier cosa; el hueco en blanco no es una opción.
      gateway.linkEmailToCurrentUser.mockRejectedValue('vaya');
      await renderSection(ANONIMA);
      await waitFor(() => expect(screen.getByText('Asegurar mi cuenta')).toBeTruthy());

      await fireEvent.changeText(
        screen.getByLabelText('Email con el que asegurar tu cuenta'),
        'ana@example.com'
      );
      await press('Asegurar mi cuenta');

      await waitFor(() =>
        expect(screen.getByText(/No hemos podido completar la operación/)).toBeTruthy()
      );
    });

    it('un fallo al cerrar sesión que no sea el bloqueo se enseña tal cual', async () => {
      gateway.signOut.mockRejectedValue(
        new AccountError('unknown', 'El servidor ha dicho que no. Inténtalo más tarde.')
      );
      await renderSection(ASEGURADA);
      await waitFor(() => expect(screen.getByText('Cerrar sesión')).toBeTruthy());

      await press('Cerrar sesión');

      await waitFor(() => expect(screen.getByText(/El servidor ha dicho que no/)).toBeTruthy());
      expect(screen.queryByText('Cerrar sesión aquí borra tus datos')).toBeNull();
    });
  });

  it('mientras hay una petición en vuelo no se lanza otra', async () => {
    // Dos toques seguidos al mismo botón son un accidente corriente en un
    // móvil, y aquí el segundo mandaría un correo de más.
    let resolver = () => {};
    gateway.linkEmailToCurrentUser.mockReturnValue(
      new Promise<void>((resolve) => {
        resolver = resolve;
      })
    );
    await renderSection(ANONIMA);
    await waitFor(() => expect(screen.getByText('Asegurar mi cuenta')).toBeTruthy());
    await fireEvent.changeText(
      screen.getByLabelText('Email con el que asegurar tu cuenta'),
      'ana@example.com'
    );

    await press('Asegurar mi cuenta');
    await waitFor(() => expect(screen.getByText('Mandando el correo…')).toBeTruthy());
    await press('Mandando el correo…');

    expect(gateway.linkEmailToCurrentUser).toHaveBeenCalledTimes(1);

    // Soltar la promesa dentro de `act`: si no, lo que hace la sección al
    // terminar la petición ocurre ya fuera del test.
    await act(async () => resolver());
  });

  it('sin sesión abierta no pinta nada', async () => {
    const { toJSON } = await renderSection({
      kind: 'none',
      userId: null,
      email: null,
      pendingEmail: null,
      recoverable: false,
    });

    await waitFor(() => expect(gateway.readAccountState).toHaveBeenCalled());
    expect(toJSON()).toBeNull();
  });

  it('sin capa de cuentas (mock en memoria) no pinta nada', async () => {
    const { toJSON } = await renderSection(null);

    await waitFor(() => expect(gateway.readAccountState).toHaveBeenCalled());
    expect(toJSON()).toBeNull();
  });
});
