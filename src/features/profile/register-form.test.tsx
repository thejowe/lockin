/**
 * Tests del registro con email y contraseña del onboarding.
 *
 * Lo que no puede fallar en silencio:
 *
 * - que la persona lo da todo de una vez (email, contraseña, repetirla y los
 *   Términos) y **después** verifica el correo, pero la contraseña no llega al
 *   servidor hasta que el email está confirmado: GoTrue no la acepta antes en
 *   una cuenta anónima. Espera en el almacén seguro y se aplica sola,
 * - que el paso lo dicta el estado de la cuenta, no un contador local,
 * - que se **asciende** la sesión (`linkEmailToCurrentUser`) y no se abre otra,
 * - que los Términos quedan aceptados en el mismo paso que la cuenta,
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

import { TERMS_VERSION } from '@/constants/legal';
import { DataProvider } from '@/data';
import { createMockRepositories, resetState } from '@/data/mock';

import {
  clearPendingPassword,
  readPendingPassword,
  stashPendingPassword,
} from './pending-password';
import { RegisterForm, accountStepProblem } from './register-form';

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

const CLAVE = 'una-clave-larga';

let repositories: Repositories;
const onDone = jest.fn();
const onSignIn = jest.fn();

beforeEach(async () => {
  jest.clearAllMocks();
  resetState();
  repositories = createMockRepositories();
  await clearPendingPassword();

  gateway.readAccountState.mockResolvedValue(ANONIMA);
  gateway.linkEmailToCurrentUser.mockResolvedValue(PENDIENTE);
  gateway.setAccountPassword.mockResolvedValue(undefined);
});

async function renderForm(state: AccountState | null = ANONIMA) {
  gateway.readAccountState.mockResolvedValue(state);

  return render(
    <DataProvider value={repositories}>
      <RegisterForm
        onDone={onDone}
        onSignIn={onSignIn}
        steps={{ account: 'Paso 2 de 4', confirm: 'Paso 3 de 4' }}
      />
    </DataProvider>
  );
}

/** Pulsa un botón y deja asentarse lo que dispara (ver `account-section.test.tsx`). */
async function press(name: string) {
  await fireEvent.press(screen.getByRole('button', { name }));
  await act(async () => {});
}

/** Rellena el paso de cuenta entero; `overrides` estropea lo que haga falta. */
async function fillAccount(
  overrides: { email?: string; password?: string; repeat?: string; terms?: boolean } = {}
) {
  const {
    email = 'ana@example.com',
    password = CLAVE,
    repeat = password,
    terms = true,
  } = overrides;
  await fireEvent.changeText(screen.getByLabelText('Email de tu cuenta'), email);
  await fireEvent.changeText(screen.getByLabelText('Contraseña de tu cuenta'), password);
  await fireEvent.changeText(screen.getByLabelText('Repite la contraseña'), repeat);
  if (terms) {
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'He leído y acepto los Términos de uso y las Normas de la comunidad',
      })
    );
  }
}

describe('accountStepProblem', () => {
  const ok = { email: 'a@b.c', password: CLAVE, repeat: CLAVE, termsAccepted: true };

  it('no pone pegas a un paso completo', () => {
    expect(accountStepProblem(ok)).toBeNull();
  });

  it('dice qué falta, de uno en uno y en orden de pantalla', () => {
    expect(accountStepProblem({ ...ok, email: '  ' })).toMatch(/Escribe tu email/);
    expect(accountStepProblem({ ...ok, password: 'corta', repeat: 'corta' })).toMatch(/al menos 8/);
    expect(accountStepProblem({ ...ok, repeat: 'otra-clave-x' })).toMatch(/no coinciden/);
    expect(accountStepProblem({ ...ok, termsAccepted: false })).toMatch(/aceptar los Términos/);
  });
});

describe('RegisterForm', () => {
  describe('paso de cuenta', () => {
    it('pide email, contraseña, repetirla y los Términos, sin «Ahora no»', async () => {
      await renderForm(ANONIMA);

      await waitFor(() => expect(screen.getByText('Crea tu cuenta')).toBeTruthy());
      expect(screen.getByText('Paso 2 de 4')).toBeTruthy();
      expect(screen.getByLabelText('Email de tu cuenta')).toBeTruthy();
      expect(screen.getByLabelText('Contraseña de tu cuenta')).toBeTruthy();
      expect(screen.getByLabelText('Repite la contraseña')).toBeTruthy();
      expect(screen.getByRole('checkbox')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Leer los Términos de uso' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Ahora no/i })).toBeNull();
    });

    it('«Crear cuenta» acepta los Términos, guarda la contraseña y asciende la sesión', async () => {
      await renderForm(ANONIMA);
      await waitFor(() => expect(screen.getByText('Crea tu cuenta')).toBeTruthy());

      await fillAccount({ email: '  ana@example.com ' });
      await press('Crear cuenta');

      await waitFor(() =>
        expect(gateway.linkEmailToCurrentUser).toHaveBeenCalledWith('ana@example.com')
      );
      // La contraseña no va al servidor todavía: espera a que se confirme el correo.
      expect(gateway.setAccountPassword).not.toHaveBeenCalled();
      expect(await readPendingPassword('uid-1')).toBe(CLAVE);
      expect((await repositories.session.getTermsAcceptance())?.version).toBe(TERMS_VERSION);
    });

    it.each([
      ['el email vacío', { email: '' }, /Escribe tu email/],
      ['una contraseña corta', { password: 'corta' }, /al menos 8 caracteres/],
      ['contraseñas distintas', { repeat: 'otra-clave-x' }, /no coinciden/],
      ['los Términos sin marcar', { terms: false }, /aceptar los Términos/],
    ])('con %s no se llama al servidor: se dice qué falta', async (_, overrides, message) => {
      await renderForm(ANONIMA);
      await waitFor(() => expect(screen.getByText('Crea tu cuenta')).toBeTruthy());

      await fillAccount(overrides);
      await press('Crear cuenta');

      await waitFor(() => expect(screen.getByText(message)).toBeTruthy());
      expect(gateway.linkEmailToCurrentUser).not.toHaveBeenCalled();
      expect(await repositories.session.getTermsAcceptance()).toBeNull();
    });

    it('sigue al paso de verificar cuando el servidor da el email por pedido', async () => {
      await renderForm(ANONIMA);
      await waitFor(() => expect(screen.getByText('Crea tu cuenta')).toBeTruthy());

      gateway.readAccountState.mockResolvedValue(PENDIENTE);
      await fillAccount();
      await press('Crear cuenta');

      await waitFor(() => expect(screen.getByText('Verifica tu email')).toBeTruthy());
      expect(screen.getByText('Paso 3 de 4')).toBeTruthy();
      expect(screen.getByText(/ana@example\.com/)).toBeTruthy();
    });

    it('un email ya en uso se ve, con el mensaje traducido', async () => {
      gateway.linkEmailToCurrentUser.mockRejectedValue(
        new AccountError(
          'email-in-use',
          'Ese email ya tiene una cuenta de cofounder. Prueba con otro.'
        )
      );
      await renderForm(ANONIMA);
      await waitFor(() => expect(screen.getByText('Crea tu cuenta')).toBeTruthy());

      await fillAccount();
      await press('Crear cuenta');

      await waitFor(() =>
        expect(
          screen.getByText('Ese email ya tiene una cuenta de cofounder. Prueba con otro.')
        ).toBeTruthy()
      );
      // …y la salida está ahí mismo: en el alta no hay perfil que abandonar.
      expect(screen.getByRole('button', { name: 'Ya tengo cuenta' })).toBeTruthy();
    });

    it('un fallo que no es un Error tampoco se queda mudo', async () => {
      gateway.linkEmailToCurrentUser.mockRejectedValue('boom');
      await renderForm(ANONIMA);
      await waitFor(() => expect(screen.getByText('Crea tu cuenta')).toBeTruthy());

      await fillAccount();
      await press('Crear cuenta');

      await waitFor(() => expect(screen.getByText(/No hemos podido completar/i)).toBeTruthy());
    });
  });

  describe('paso de verificar el correo', () => {
    it('dice a qué correo se ha mandado y no pide nada más', async () => {
      await renderForm(PENDIENTE);

      await waitFor(() => expect(screen.getByText('Verifica tu email')).toBeTruthy());
      expect(screen.getByText(/Te hemos mandado un correo a ana@example\.com/)).toBeTruthy();
      expect(screen.queryByLabelText('Contraseña de tu cuenta')).toBeNull();
    });

    it('«Reenviar el correo» vuelve a pedir el enlace para el mismo email', async () => {
      await renderForm(PENDIENTE);
      await waitFor(() => expect(screen.getByText('Verifica tu email')).toBeTruthy());

      await press('Reenviar el correo');

      await waitFor(() =>
        expect(gateway.linkEmailToCurrentUser).toHaveBeenCalledWith('ana@example.com')
      );
      expect(screen.getByText('Te lo hemos vuelto a mandar.')).toBeTruthy();
    });

    it('«Ya lo he verificado» relee la cuenta y, si ya es recuperable, pone la contraseña guardada y sigue', async () => {
      await stashPendingPassword(CLAVE, 'uid-1');
      await renderForm(PENDIENTE);
      await waitFor(() => expect(screen.getByText('Verifica tu email')).toBeTruthy());

      gateway.readAccountState.mockResolvedValue(CONFIRMADA);
      await press('Ya lo he verificado');

      await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
      expect(gateway.setAccountPassword).toHaveBeenCalledWith(CLAVE, 'uid-1');
      expect(await readPendingPassword('uid-1')).toBeNull();
    });

    it('«Usar otro email» vuelve al paso de cuenta', async () => {
      await renderForm(PENDIENTE);
      await waitFor(() => expect(screen.getByText('Verifica tu email')).toBeTruthy());

      await press('Usar otro email');

      expect(screen.getByText('Crea tu cuenta')).toBeTruthy();
      expect(screen.getByLabelText('Email de tu cuenta')).toBeTruthy();
    });

    it('hay salida para quien ya tiene cuenta', async () => {
      await renderForm(PENDIENTE);
      await waitFor(() => expect(screen.getByText('Verifica tu email')).toBeTruthy());

      await press('Ya tengo cuenta');
      expect(onSignIn).toHaveBeenCalledTimes(1);
    });
  });

  describe('con el email ya confirmado', () => {
    it('al volver del correo aplica sola la contraseña guardada y sigue', async () => {
      await stashPendingPassword(CLAVE, 'uid-1');
      await renderForm(CONFIRMADA);

      await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
      expect(gateway.setAccountPassword).toHaveBeenCalledWith(CLAVE, 'uid-1');
      expect(screen.queryByLabelText('Contraseña de tu cuenta')).toBeNull();
    });

    it('una contraseña que esperaba para otra cuenta no se le pone a esta: se borra y se sigue', async () => {
      await stashPendingPassword(CLAVE, 'uid-de-otra');
      await renderForm(CONFIRMADA);

      await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
      expect(gateway.setAccountPassword).not.toHaveBeenCalled();
      expect(await readPendingPassword('uid-de-otra')).toBeNull();
    });

    it('sin contraseña guardada la vuelve a pedir, con su repetición', async () => {
      await renderForm(CONFIRMADA);

      await waitFor(() => expect(screen.getByText('Elige tu contraseña')).toBeTruthy());
      expect(screen.getByLabelText('Email confirmado: ana@example.com')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Ya tengo cuenta' })).toBeNull();

      await fireEvent.changeText(screen.getByLabelText('Contraseña de tu cuenta'), CLAVE);
      await fireEvent.changeText(screen.getByLabelText('Repite la contraseña'), CLAVE);
      await press('Guardar y continuar');

      await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
      expect(gateway.setAccountPassword).toHaveBeenCalledWith(CLAVE);
    });

    it('si las dos no coinciden no se llama al servidor', async () => {
      await renderForm(CONFIRMADA);
      await waitFor(() => expect(screen.getByText('Elige tu contraseña')).toBeTruthy());

      await fireEvent.changeText(screen.getByLabelText('Contraseña de tu cuenta'), CLAVE);
      await fireEvent.changeText(screen.getByLabelText('Repite la contraseña'), 'otra-clave-x');
      await press('Guardar y continuar');

      await waitFor(() => expect(screen.getByText(/no coinciden/)).toBeTruthy());
      expect(gateway.setAccountPassword).not.toHaveBeenCalled();
      expect(onDone).not.toHaveBeenCalled();
    });

    it('si el servidor rechaza la guardada se ve el motivo y se pide otra', async () => {
      await stashPendingPassword(CLAVE, 'uid-1');
      gateway.setAccountPassword.mockRejectedValueOnce(
        new AccountError('weak-password', 'Esa contraseña es demasiado débil.')
      );
      await renderForm(CONFIRMADA);

      await waitFor(() => expect(screen.getByText('Elige tu contraseña')).toBeTruthy());
      expect(screen.getByText('Esa contraseña es demasiado débil.')).toBeTruthy();
      expect(onDone).not.toHaveBeenCalled();
    });
  });

  it('si no se puede leer la cuenta lo dice y deja reintentar o entrar', async () => {
    gateway.readAccountState.mockRejectedValue(new Error('offline'));
    render(
      <DataProvider value={repositories}>
        <RegisterForm onDone={onDone} onSignIn={onSignIn} />
      </DataProvider>
    );

    await waitFor(() =>
      expect(screen.getByText('No hemos podido comprobar tu cuenta')).toBeTruthy()
    );
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ya tengo cuenta' })).toBeTruthy();
  });
});
