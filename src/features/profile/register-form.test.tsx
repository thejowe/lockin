/**
 * Tests del registro con email y contraseña del onboarding.
 *
 * Lo que no puede fallar en silencio:
 *
 * - que el alta sea **tres tiempos** y el paso lo dicte el estado de la cuenta:
 *   email, «falta confirmar», contraseña. GoTrue no acepta contraseña en una
 *   cuenta anónima sin email verificado, así que el formulario nunca pide las
 *   dos cosas a la vez,
 * - que se **asciende** la sesión (`linkEmailToCurrentUser`) y no se abre otra,
 * - que no hay «Ahora no»: el registro es obligatorio (2026-09-20),
 * - que «Ya tengo cuenta» está siempre a mano hasta que la cuenta está hecha,
 *   porque quien reinstala aterriza aquí y es su única salida,
 * - y que los fallos se ven, con el mensaje ya traducido.
 *
 * Como `AccountSection`, se prueba contra `account-gateway` sustituido: el
 * hook `use-account-actions` que comparten es justo lo que se ejercita.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DataProvider } from '@/data';
import { createMockRepositories, resetState } from '@/data/mock';

import { RegisterForm } from './register-form';

import type { AccountState } from './account-gateway';
import type { Repositories } from '@/data';

jest.mock('./account-gateway', () => ({
  ...jest.requireActual('./account-gateway'),
  readAccountState: jest.fn(),
  linkEmailToCurrentUser: jest.fn(),
  setAccountPassword: jest.fn(),
}));

const gateway = jest.requireMock('./account-gateway') as {
  AccountError: typeof import('./account-gateway').AccountError;
  readAccountState: jest.Mock;
  linkEmailToCurrentUser: jest.Mock;
  setAccountPassword: jest.Mock;
};

const { AccountError } = gateway;

/** Cuenta anónima: la que nace sola al abrir la app. */
const ANONIMA: AccountState = {
  kind: 'anonymous',
  userId: 'uid-1',
  email: null,
  pendingEmail: null,
  recoverable: false,
};

/** Email pedido y todavía sin confirmar. */
const PENDIENTE: AccountState = {
  ...ANONIMA,
  kind: 'pending-email',
  pendingEmail: 'ana@example.com',
};

/** Email confirmado: ya es recuperable y solo falta la contraseña. */
const CONFIRMADA: AccountState = {
  kind: 'email',
  userId: 'uid-1',
  email: 'ana@example.com',
  pendingEmail: null,
  recoverable: true,
};

let repositories: Repositories;
const onDone = jest.fn();
const onSignIn = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  resetState();
  repositories = createMockRepositories();

  gateway.readAccountState.mockResolvedValue(ANONIMA);
  gateway.linkEmailToCurrentUser.mockResolvedValue(PENDIENTE);
  gateway.setAccountPassword.mockResolvedValue(undefined);
});

async function renderForm(state: AccountState | null = ANONIMA) {
  gateway.readAccountState.mockResolvedValue(state);

  return render(
    <DataProvider value={repositories}>
      <RegisterForm onDone={onDone} onSignIn={onSignIn} />
    </DataProvider>
  );
}

/** Pulsa un botón y deja asentarse lo que dispara (ver `account-section.test.tsx`). */
async function press(name: string) {
  await fireEvent.press(screen.getByRole('button', { name }));
  await act(async () => {});
}

describe('RegisterForm', () => {
  describe('paso 1: email', () => {
    it('pide solo el email: la contraseña llega cuando el correo esté confirmado', async () => {
      await renderForm(ANONIMA);

      await waitFor(() => expect(screen.getByText('Crea tu cuenta')).toBeTruthy());
      expect(screen.getByLabelText('Email de tu cuenta')).toBeTruthy();
      expect(screen.queryByLabelText('Contraseña de tu cuenta')).toBeNull();
      expect(screen.getByText(/la contraseña la eliges cuando lo hayas confirmado/i)).toBeTruthy();
    });

    it('«Crear cuenta» asciende la sesión con el email tecleado, sin espacios de más', async () => {
      await renderForm(ANONIMA);
      await waitFor(() => expect(screen.getByText('Crea tu cuenta')).toBeTruthy());

      await fireEvent.changeText(screen.getByLabelText('Email de tu cuenta'), '  ana@example.com ');
      await press('Crear cuenta');

      await waitFor(() =>
        expect(gateway.linkEmailToCurrentUser).toHaveBeenCalledWith('ana@example.com')
      );
    });

    it('con el email vacío no se llama al servidor: se dice qué falta', async () => {
      await renderForm(ANONIMA);
      await waitFor(() => expect(screen.getByText('Crea tu cuenta')).toBeTruthy());

      await press('Crear cuenta');

      await waitFor(() => expect(screen.getByText(/Escribe tu email/i)).toBeTruthy());
      expect(gateway.linkEmailToCurrentUser).not.toHaveBeenCalled();
    });

    it('sigue al paso de confirmar cuando el servidor da el email por pedido', async () => {
      await renderForm(ANONIMA);
      await waitFor(() => expect(screen.getByText('Crea tu cuenta')).toBeTruthy());

      gateway.readAccountState.mockResolvedValue(PENDIENTE);
      await fireEvent.changeText(screen.getByLabelText('Email de tu cuenta'), 'ana@example.com');
      await press('Crear cuenta');

      await waitFor(() => expect(screen.getByText('Confirma tu email')).toBeTruthy());
      expect(screen.getByText(/ana@example\.com/)).toBeTruthy();
    });

    it('un email ya en uso se ve, con el mensaje traducido', async () => {
      gateway.linkEmailToCurrentUser.mockRejectedValue(
        new AccountError(
          'email-in-use',
          'Ese email ya tiene una cuenta de LockIn. Prueba con otro.'
        )
      );
      await renderForm(ANONIMA);
      await waitFor(() => expect(screen.getByText('Crea tu cuenta')).toBeTruthy());

      await fireEvent.changeText(screen.getByLabelText('Email de tu cuenta'), 'ana@example.com');
      await press('Crear cuenta');

      await waitFor(() =>
        expect(
          screen.getByText('Ese email ya tiene una cuenta de LockIn. Prueba con otro.')
        ).toBeTruthy()
      );
      // …y la salida está ahí mismo: en el alta no hay perfil que abandonar.
      expect(screen.getByRole('button', { name: 'Ya tengo cuenta' })).toBeTruthy();
    });

    it('un fallo que no es un Error tampoco se queda mudo', async () => {
      gateway.linkEmailToCurrentUser.mockRejectedValue('boom');
      await renderForm(ANONIMA);
      await waitFor(() => expect(screen.getByText('Crea tu cuenta')).toBeTruthy());

      await fireEvent.changeText(screen.getByLabelText('Email de tu cuenta'), 'ana@example.com');
      await press('Crear cuenta');

      await waitFor(() => expect(screen.getByText(/No hemos podido completar/i)).toBeTruthy());
    });
  });

  describe('paso 2: confirmar el correo', () => {
    it('dice a qué correo se ha mandado y no ofrece contraseña todavía', async () => {
      await renderForm(PENDIENTE);

      await waitFor(() => expect(screen.getByText('Confirma tu email')).toBeTruthy());
      expect(screen.getByText(/Te hemos mandado un correo a ana@example\.com/)).toBeTruthy();
      expect(screen.queryByLabelText('Contraseña de tu cuenta')).toBeNull();
    });

    it('«Reenviar el correo» vuelve a pedir el enlace para el mismo email', async () => {
      await renderForm(PENDIENTE);
      await waitFor(() => expect(screen.getByText('Confirma tu email')).toBeTruthy());

      await press('Reenviar el correo');

      await waitFor(() =>
        expect(gateway.linkEmailToCurrentUser).toHaveBeenCalledWith('ana@example.com')
      );
      expect(screen.getByText('Te lo hemos vuelto a mandar.')).toBeTruthy();
    });

    it('«Ya lo he confirmado» relee la cuenta y, si ya es recuperable, pasa a la contraseña', async () => {
      await renderForm(PENDIENTE);
      await waitFor(() => expect(screen.getByText('Confirma tu email')).toBeTruthy());

      gateway.readAccountState.mockResolvedValue(CONFIRMADA);
      await press('Ya lo he confirmado');

      await waitFor(() => expect(screen.getByText('Elige tu contraseña')).toBeTruthy());
    });

    it('«Usar otro email» vuelve al formulario de email', async () => {
      await renderForm(PENDIENTE);
      await waitFor(() => expect(screen.getByText('Confirma tu email')).toBeTruthy());

      await press('Usar otro email');

      expect(screen.getByText('Crea tu cuenta')).toBeTruthy();
      expect(screen.getByLabelText('Email de tu cuenta')).toBeTruthy();
    });
  });

  describe('paso 3: contraseña', () => {
    it('con el email ya confirmado pide la contraseña y enseña de qué email es', async () => {
      await renderForm(CONFIRMADA);

      await waitFor(() => expect(screen.getByText('Elige tu contraseña')).toBeTruthy());
      expect(screen.getByLabelText('Email confirmado: ana@example.com')).toBeTruthy();
      expect(screen.queryByLabelText('Email de tu cuenta')).toBeNull();
    });

    it('«Guardar y continuar» guarda la contraseña y avisa de que el alta sigue', async () => {
      await renderForm(CONFIRMADA);
      await waitFor(() => expect(screen.getByText('Elige tu contraseña')).toBeTruthy());

      await fireEvent.changeText(screen.getByLabelText('Contraseña de tu cuenta'), 'secreta-123');
      await press('Guardar y continuar');

      await waitFor(() => expect(gateway.setAccountPassword).toHaveBeenCalledWith('secreta-123'));
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('con la contraseña vacía no se llama al servidor y no se sigue', async () => {
      await renderForm(CONFIRMADA);
      await waitFor(() => expect(screen.getByText('Elige tu contraseña')).toBeTruthy());

      await press('Guardar y continuar');

      await waitFor(() => expect(screen.getByText(/Escribe la contraseña/i)).toBeTruthy());
      expect(gateway.setAccountPassword).not.toHaveBeenCalled();
      expect(onDone).not.toHaveBeenCalled();
    });

    it('si el servidor la rechaza se ve el motivo y no se sigue', async () => {
      gateway.setAccountPassword.mockRejectedValue(
        new AccountError('weak-password', 'Esa contraseña es demasiado fácil de adivinar.')
      );
      await renderForm(CONFIRMADA);
      await waitFor(() => expect(screen.getByText('Elige tu contraseña')).toBeTruthy());

      await fireEvent.changeText(screen.getByLabelText('Contraseña de tu cuenta'), '1234');
      await press('Guardar y continuar');

      await waitFor(() =>
        expect(screen.getByText('Esa contraseña es demasiado fácil de adivinar.')).toBeTruthy()
      );
      expect(onDone).not.toHaveBeenCalled();
    });

    it('con la cuenta ya hecha, «Ya tengo cuenta» desaparece: entrar en otra la abandonaría', async () => {
      await renderForm(CONFIRMADA);

      await waitFor(() => expect(screen.getByText('Elige tu contraseña')).toBeTruthy());
      expect(screen.queryByRole('button', { name: 'Ya tengo cuenta' })).toBeNull();
    });
  });

  describe('lo que es común a los tres pasos', () => {
    it.each([
      ['email', ANONIMA, 'Crea tu cuenta'],
      ['confirmar', PENDIENTE, 'Confirma tu email'],
    ])('en el paso de %s hay salida para quien ya tiene cuenta', async (_paso, state, title) => {
      await renderForm(state);
      await waitFor(() => expect(screen.getByText(title)).toBeTruthy());

      await fireEvent.press(screen.getByRole('button', { name: 'Ya tengo cuenta' }));

      expect(onSignIn).toHaveBeenCalledTimes(1);
    });

    it('no hay «Ahora no» ni ninguna otra forma de saltarse el registro', async () => {
      await renderForm(ANONIMA);
      await waitFor(() => expect(screen.getByText('Crea tu cuenta')).toBeTruthy());

      expect(screen.queryByText(/ahora no|más tarde|omitir|saltar/i)).toBeNull();
      expect(onDone).not.toHaveBeenCalled();
    });

    it('si no se puede leer la cuenta lo dice y deja reintentar, sin dejar pasar', async () => {
      gateway.readAccountState.mockRejectedValue(new Error('Sin conexión.'));
      await render(
        <DataProvider value={repositories}>
          <RegisterForm onDone={onDone} onSignIn={onSignIn} />
        </DataProvider>
      );

      await waitFor(() =>
        expect(screen.getByText('No hemos podido comprobar tu cuenta')).toBeTruthy()
      );
      expect(screen.getByText('Sin conexión.')).toBeTruthy();

      gateway.readAccountState.mockResolvedValue(ANONIMA);
      await press('Reintentar');

      await waitFor(() => expect(screen.getByText('Crea tu cuenta')).toBeTruthy());
      expect(onDone).not.toHaveBeenCalled();
    });

    it('no pinta nada mientras lee la cuenta', async () => {
      gateway.readAccountState.mockReturnValue(new Promise(() => {}));
      await render(
        <DataProvider value={repositories}>
          <RegisterForm onDone={onDone} onSignIn={onSignIn} />
        </DataProvider>
      );

      expect(screen.toJSON()).toBeNull();
    });
  });
});
