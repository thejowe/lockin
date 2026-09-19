/**
 * Tests de «Ya tengo cuenta».
 *
 * Lo que no puede fallar en silencio:
 *
 * - que entrar con credenciales buenas avise a quien monta la pantalla, y con
 *   las malas se quede aquí y lo cuente sin revelar cuál de las dos falló,
 * - que entrar en otra cuenta no tire a la basura un perfil sin email sin
 *   avisar antes — y que el aviso salga de lo que dice el servidor ahora, no de
 *   una caché —,
 * - que un fallo al comprobarlo NO deje entrar,
 * - y que el correo de recuperación no diga si el email existe.
 *
 * La capa de cuentas se sustituye por dobles, igual que en
 * `account-section.test.tsx`; `AccountError` viene del módulo real porque el
 * formulario lo usa con `instanceof`.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { DataProvider } from '@/data';
import { createMockRepositories, resetState } from '@/data/mock';
import { buildProfileInput } from '@/data/test-fixtures';

import { SignInForm } from './sign-in-form';

import type { AccountState } from './account-gateway';
import type { Repositories } from '@/data';

jest.mock('./account-gateway', () => ({
  ...jest.requireActual('./account-gateway'),
  readAccountState: jest.fn(),
  signInWithEmail: jest.fn(),
  sendPasswordReset: jest.fn(),
}));

const gateway = jest.requireMock('./account-gateway') as {
  AccountError: typeof import('./account-gateway').AccountError;
  readAccountState: jest.Mock;
  signInWithEmail: jest.Mock;
  sendPasswordReset: jest.Mock;
};

const { AccountError } = gateway;

const ANONIMA: AccountState = {
  kind: 'anonymous',
  userId: 'uid-1',
  email: null,
  pendingEmail: null,
  recoverable: false,
};

const ASEGURADA: AccountState = {
  kind: 'email',
  userId: 'uid-1',
  email: 'ana@example.com',
  pendingEmail: null,
  recoverable: true,
};

const onSignedIn = jest.fn();
const onCancel = jest.fn();

let repositories: Repositories;

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  resetState();
  repositories = createMockRepositories();

  gateway.readAccountState.mockResolvedValue(ANONIMA);
  gateway.signInWithEmail.mockResolvedValue('uid-2');
  gateway.sendPasswordReset.mockResolvedValue(undefined);
});

async function renderForm() {
  return render(
    <DataProvider value={repositories}>
      <SignInForm onSignedIn={onSignedIn} onCancel={onCancel} />
    </DataProvider>
  );
}

/** Pulsa un botón y deja asentarse lo que dispara: el resto de estados cae dentro de `act`. */
async function press(name: string) {
  await fireEvent.press(screen.getByRole('button', { name }));
  await act(async () => {});
}

async function fill(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText('Email de tu cuenta'), email);
  await fireEvent.changeText(screen.getByLabelText('Contraseña de tu cuenta'), password);
}

/** Da el perfil por creado en la cuenta de este dispositivo. */
async function withProfile() {
  await repositories.session.setActiveMode('par');
  await repositories.profiles.saveCurrent(buildProfileInput());
}

describe('SignInForm', () => {
  describe('entrar', () => {
    it('con credenciales buenas entra y avisa, con el email sin espacios', async () => {
      await renderForm();

      await fill('  ana@example.com ', 'secreta-123');
      await press('Entrar');

      expect(gateway.signInWithEmail).toHaveBeenCalledWith('ana@example.com', 'secreta-123');
      expect(onSignedIn).toHaveBeenCalledTimes(1);
    });

    it('con credenciales erróneas se queda, lo dice en español y no delata cuál falló', async () => {
      gateway.signInWithEmail.mockRejectedValue(
        new AccountError('unknown', 'Invalid login credentials', { code: 'invalid_credentials' })
      );
      await renderForm();

      await fill('ana@example.com', 'mala');
      await press('Entrar');

      expect(screen.getByText(/Email o contraseña incorrectos/)).toBeTruthy();
      expect(screen.queryByText('Invalid login credentials')).toBeNull();
      expect(onSignedIn).not.toHaveBeenCalled();
    });

    it('un fallo que sí viene traducido se enseña tal cual', async () => {
      gateway.signInWithEmail.mockRejectedValue(
        new AccountError('offline', 'No hay conexión con el servidor.')
      );
      await renderForm();

      await fill('ana@example.com', 'secreta-123');
      await press('Entrar');

      expect(screen.getByText('No hay conexión con el servidor.')).toBeTruthy();
      expect(onSignedIn).not.toHaveBeenCalled();
    });

    it('un rechazo que no es un Error también se cuenta', async () => {
      gateway.signInWithEmail.mockRejectedValue('boom');
      await renderForm();

      await fill('ana@example.com', 'secreta-123');
      await press('Entrar');

      expect(screen.getByText(/No hemos podido completar la operación/)).toBeTruthy();
    });

    it('sin email o sin contraseña no pregunta al servidor', async () => {
      await renderForm();

      await press('Entrar');
      expect(screen.getByText('Escribe tu email y tu contraseña.')).toBeTruthy();

      await fill('ana@example.com', '');
      await press('Entrar');

      expect(gateway.signInWithEmail).not.toHaveBeenCalled();
      expect(gateway.readAccountState).not.toHaveBeenCalled();
    });

    it('no se puede pulsar dos veces mientras espera', async () => {
      let release: (id: string) => void = () => {};
      gateway.signInWithEmail.mockReturnValue(
        new Promise<string>((resolve) => (release = resolve))
      );
      await renderForm();

      await fill('ana@example.com', 'secreta-123');
      await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
      await act(async () => {});
      await fireEvent.press(screen.getByRole('button', { name: 'Entrando…' }));

      expect(gateway.signInWithEmail).toHaveBeenCalledTimes(1);

      await act(async () => release('uid-2'));
      expect(onSignedIn).toHaveBeenCalledTimes(1);
    });
  });

  describe('abandonar la cuenta de este teléfono', () => {
    it('avisa antes de dejar atrás un perfil sin email, y no entra todavía', async () => {
      await withProfile();
      await renderForm();

      await fill('ana@example.com', 'secreta-123');
      await press('Entrar');

      expect(screen.getByText('Entrar aquí deja atrás el perfil de este teléfono')).toBeTruthy();
      expect(gateway.signInWithEmail).not.toHaveBeenCalled();
      expect(onSignedIn).not.toHaveBeenCalled();
    });

    it('si se confirma, entra', async () => {
      await withProfile();
      await renderForm();

      await fill('ana@example.com', 'secreta-123');
      await press('Entrar');
      await press('Entrar y dejar este perfil');

      expect(gateway.signInWithEmail).toHaveBeenCalledWith('ana@example.com', 'secreta-123');
      expect(onSignedIn).toHaveBeenCalledTimes(1);
    });

    it('«Mejor no» cierra el aviso y no entra', async () => {
      await withProfile();
      await renderForm();

      await fill('ana@example.com', 'secreta-123');
      await press('Entrar');
      await press('Mejor no');

      expect(screen.queryByText('Entrar aquí deja atrás el perfil de este teléfono')).toBeNull();
      expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
      expect(gateway.signInWithEmail).not.toHaveBeenCalled();
    });

    it('si la cuenta anónima no tiene perfil no hay nada que perder: entra sin avisar', async () => {
      await renderForm();

      await fill('ana@example.com', 'secreta-123');
      await press('Entrar');

      expect(screen.queryByText(/deja atrás el perfil/)).toBeNull();
      expect(onSignedIn).toHaveBeenCalledTimes(1);
    });

    it('si la cuenta de este teléfono ya es recuperable, entra sin avisar aunque tenga perfil', async () => {
      gateway.readAccountState.mockResolvedValue(ASEGURADA);
      await withProfile();
      await renderForm();

      await fill('ana@example.com', 'secreta-123');
      await press('Entrar');

      expect(screen.queryByText(/deja atrás el perfil/)).toBeNull();
      expect(onSignedIn).toHaveBeenCalledTimes(1);
    });

    it('sin sesión abierta o sin capa de cuentas tampoco hay nada que perder', async () => {
      await withProfile();
      await renderForm();
      await fill('ana@example.com', 'secreta-123');

      gateway.readAccountState.mockResolvedValueOnce({ ...ANONIMA, kind: 'none' });
      await press('Entrar');
      expect(onSignedIn).toHaveBeenCalledTimes(1);

      gateway.readAccountState.mockResolvedValueOnce(null);
      await press('Entrar');
      expect(onSignedIn).toHaveBeenCalledTimes(2);
    });

    it('si no puede comprobar qué se perdería, no entra y lo cuenta', async () => {
      gateway.readAccountState.mockRejectedValue(new Error('Sin conexión.'));
      await renderForm();

      await fill('ana@example.com', 'secreta-123');
      await press('Entrar');

      expect(screen.getByText('Sin conexión.')).toBeTruthy();
      expect(gateway.signInWithEmail).not.toHaveBeenCalled();
    });

    it('el perfil se mira en el momento: uno creado después de montar también avisa', async () => {
      await renderForm();
      await fill('ana@example.com', 'secreta-123');

      await withProfile();
      await press('Entrar');

      expect(screen.getByText('Entrar aquí deja atrás el perfil de este teléfono')).toBeTruthy();
    });
  });

  describe('he olvidado mi contraseña', () => {
    it('manda el correo y no dice si el email existe', async () => {
      await renderForm();

      await fireEvent.changeText(screen.getByLabelText('Email de tu cuenta'), ' ana@example.com ');
      await press('He olvidado mi contraseña');

      expect(gateway.sendPasswordReset).toHaveBeenCalledWith('ana@example.com');
      expect(screen.getByText(/Si ese email tiene una cuenta/)).toBeTruthy();
      expect(onSignedIn).not.toHaveBeenCalled();
    });

    it('sin email pide que lo escriba y no manda nada', async () => {
      await renderForm();

      await press('He olvidado mi contraseña');

      expect(screen.getByText(/Escribe tu email y te mandamos un correo/)).toBeTruthy();
      expect(gateway.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('si el servidor lo rechaza, enseña el error ya traducido', async () => {
      gateway.sendPasswordReset.mockRejectedValue(
        new AccountError('too-many-emails', 'Se han mandado demasiados correos.')
      );
      await renderForm();

      await fireEvent.changeText(screen.getByLabelText('Email de tu cuenta'), 'ana@example.com');
      await press('He olvidado mi contraseña');

      expect(screen.getByText('Se han mandado demasiados correos.')).toBeTruthy();
    });
  });

  describe('accesibilidad y copy', () => {
    it('los dos campos se anuncian solos y la contraseña va oculta', async () => {
      await renderForm();

      expect(screen.getByLabelText('Email de tu cuenta')).toBeTruthy();
      expect(screen.getByLabelText('Contraseña de tu cuenta').props.secureTextEntry).toBe(true);
    });

    it('no habla de registrarse ni de crear cuenta: aquí nadie crea nada', async () => {
      await renderForm();

      expect(screen.queryByText(/crear cuenta|reg[íi]strate|registrarte/i)).toBeNull();
    });

    it('«Volver» sale sin haber entrado', async () => {
      await renderForm();

      await press('Volver');

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(gateway.signInWithEmail).not.toHaveBeenCalled();
    });
  });
});
