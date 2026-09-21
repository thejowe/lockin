import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import {
  AccountError,
  completeAuthLink,
  currentUserId,
  ensureUserId,
  getAccountState,
  linkEmailToCurrentUser,
  linkGithubIdentity,
  sendPasswordReset,
  setAccountPassword,
  signOut,
  unlinkGithubIdentity,
} from './auth';
import { getSupabaseClient } from './client';

jest.mock('./client', () => ({ getSupabaseClient: jest.fn() }));
jest.mock('expo-linking', () => ({ createURL: jest.fn() }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
const auth = {
  getSession: jest.fn(),
  getUser: jest.fn(),
  signInAnonymously: jest.fn(),
  signOut: jest.fn(),
  updateUser: jest.fn(),
  resetPasswordForEmail: jest.fn(),
  verifyOtp: jest.fn(),
  linkIdentity: jest.fn(),
  exchangeCodeForSession: jest.fn(),
  getUserIdentities: jest.fn(),
  unlinkIdentity: jest.fn(),
};

/** La forma mínima de `auth.users` que mira `describeUser`. */
function user(overrides: Record<string, unknown> = {}) {
  return { id: 'usuario-1', email: null, new_email: null, email_confirmed_at: null, ...overrides };
}

/** Deja la sesión abierta con ese usuario, tanto en local como en el servidor. */
function signedInAs(overrides: Record<string, unknown> = {}) {
  const current = user(overrides);
  auth.getSession.mockResolvedValue({ data: { session: { user: current } }, error: null });
  auth.getUser.mockResolvedValue({ data: { user: current }, error: null });
  return current;
}

/** Un error de GoTrue tal y como llega: lo que importa es el `code`. */
function gotrueError(code: string, message = 'error del servidor') {
  return Object.assign(new Error(message), { code, status: 422 });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(Linking.createURL).mockReturnValue('lockin://auth/callback');
  auth.linkIdentity.mockResolvedValue({
    data: { url: 'https://github.com/login/oauth' },
    error: null,
  });
  auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({
    type: 'success',
    url: 'lockin://auth/callback?code=one-use-code',
  });
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue({ auth } as unknown as ReturnType<typeof getSupabaseClient>);
});
it('reutiliza la identidad guardada al arrancar', async () => {
  auth.getSession.mockResolvedValue({
    data: { session: { user: { id: 'existing-user' } } },
    error: null,
  });
  await expect(ensureUserId()).resolves.toBe('existing-user');
  expect(auth.signInAnonymously).not.toHaveBeenCalled();
});
it('un error de renovación no crea otra cuenta y permite recuperar la original', async () => {
  const error = new Error('No se pudo renovar la sesión');
  auth.getSession.mockResolvedValueOnce({ data: { session: null }, error });
  await expect(ensureUserId()).rejects.toBe(error);
  expect(auth.signInAnonymously).not.toHaveBeenCalled();
  auth.getSession.mockResolvedValueOnce({
    data: { session: { user: { id: 'existing-user' } } },
    error: null,
  });
  await expect(ensureUserId()).resolves.toBe('existing-user');
});
it('currentUserId distingue un fallo de una sesión ausente', async () => {
  const error = new Error('Error de almacenamiento');
  auth.getSession.mockResolvedValueOnce({ data: { session: null }, error });
  await expect(currentUserId()).rejects.toBe(error);
  auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
  await expect(currentUserId()).resolves.toBeNull();
});

describe('linkGithubIdentity', () => {
  it('vincula GitHub a la cuenta actual y canjea el code PKCE', async () => {
    await expect(linkGithubIdentity()).resolves.toBe(true);
    // Sin barra: con ella, en release sale `lockin:///auth/callback` y GoTrue lo rechaza.
    expect(Linking.createURL).toHaveBeenCalledWith('auth/callback');
    expect(auth.linkIdentity).toHaveBeenCalledWith({
      provider: 'github',
      options: { redirectTo: 'lockin://auth/callback', skipBrowserRedirect: true },
    });
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      'https://github.com/login/oauth',
      'lockin://auth/callback'
    );
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('one-use-code');
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it.each(['cancel', 'dismiss'] as const)(
    'devuelve false al cerrar el navegador: %s',
    async (type) => {
      jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({
        type: type as
          WebBrowser.WebBrowserResultType.CANCEL | WebBrowser.WebBrowserResultType.DISMISS,
      });
      await expect(linkGithubIdentity()).resolves.toBe(false);
      expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['Manual linking is disabled', 'Enable Manual Linking'],
    [
      'Identity already linked',
      'Esa cuenta de GitHub ya está verificada en otro perfil de LockIn.',
    ],
  ])('explica el error de configuración o identidad: %s', async (message, expected) => {
    auth.linkIdentity.mockResolvedValueOnce({ data: null, error: new Error(message) });
    await expect(linkGithubIdentity()).rejects.toThrow(expected);
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('propaga otros errores del servidor sin abrir el navegador', async () => {
    const error = new Error('Sin conexión');
    auth.linkIdentity.mockResolvedValueOnce({ data: null, error });
    await expect(linkGithubIdentity()).rejects.toBe(error);
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('no completa la verificación si falta el code', async () => {
    jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValueOnce({
      type: 'success',
      url: 'lockin://auth/callback',
    });
    await expect(linkGithubIdentity()).rejects.toThrow('GitHub no devolvió el código');
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('propaga un canje PKCE fallido', async () => {
    const error = new Error('Código caducado');
    auth.exchangeCodeForSession.mockResolvedValueOnce({ error });
    await expect(linkGithubIdentity()).rejects.toBe(error);
  });
});

describe('unlinkGithubIdentity', () => {
  it('desvincula solo la identidad de GitHub', async () => {
    const github = { id: 'github-id', provider: 'github' };
    auth.getUserIdentities.mockResolvedValueOnce({
      data: { identities: [{ id: 'email-id', provider: 'email' }, github] },
      error: null,
    });
    auth.unlinkIdentity.mockResolvedValueOnce({ error: null });
    await expect(unlinkGithubIdentity()).resolves.toBeUndefined();
    expect(auth.unlinkIdentity).toHaveBeenCalledWith(github);
  });

  it('sin GitHub no desvincula otras identidades', async () => {
    auth.getUserIdentities.mockResolvedValueOnce({
      data: { identities: [{ id: 'email-id', provider: 'email' }] },
      error: null,
    });
    await expect(unlinkGithubIdentity()).resolves.toBeUndefined();
    expect(auth.unlinkIdentity).not.toHaveBeenCalled();
  });

  it('propaga errores al consultar identidades', async () => {
    const error = new Error('Sesión caducada');
    auth.getUserIdentities.mockResolvedValueOnce({ data: null, error });
    await expect(unlinkGithubIdentity()).rejects.toBe(error);
    expect(auth.unlinkIdentity).not.toHaveBeenCalled();
  });

  it('propaga errores al desvincular GitHub', async () => {
    const error = new Error('No se puede desvincular');
    auth.getUserIdentities.mockResolvedValueOnce({
      data: { identities: [{ id: 'github-id', provider: 'github' }] },
      error: null,
    });
    auth.unlinkIdentity.mockResolvedValueOnce({ error });
    await expect(unlinkGithubIdentity()).rejects.toBe(error);
  });
});

describe('getAccountState', () => {
  it('sin sesión no hay cuenta que proteger', async () => {
    auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(getAccountState()).resolves.toEqual({
      kind: 'none',
      userId: null,
      email: null,
      pendingEmail: null,
      recoverable: false,
    });
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it('la cuenta anónima no es recuperable', async () => {
    signedInAs({ is_anonymous: true });
    await expect(getAccountState()).resolves.toMatchObject({
      kind: 'anonymous',
      userId: 'usuario-1',
      email: null,
      pendingEmail: null,
      recoverable: false,
    });
  });

  it('el email sintético del paso 3 no cuenta como email', async () => {
    signedInAs({ email: 'device-a1b2c3@lockin.app', email_confirmed_at: '2026-09-17T10:00:00Z' });
    await expect(getAccountState()).resolves.toMatchObject({
      kind: 'device',
      email: null,
      pendingEmail: null,
      recoverable: false,
    });
  });

  it('un email pendiente de confirmar todavía no salva la cuenta', async () => {
    signedInAs({ is_anonymous: true, new_email: 'ana@example.com' });
    await expect(getAccountState()).resolves.toMatchObject({
      kind: 'pending-email',
      email: null,
      pendingEmail: 'ana@example.com',
      recoverable: false,
    });
  });

  it('un email presente pero sin confirmar sigue siendo pendiente', async () => {
    signedInAs({ email: 'ana@example.com', email_confirmed_at: null });
    await expect(getAccountState()).resolves.toMatchObject({
      kind: 'pending-email',
      email: null,
      pendingEmail: 'ana@example.com',
      recoverable: false,
    });
  });

  it('con el email confirmado la cuenta ya es recuperable', async () => {
    signedInAs({ email: 'ana@example.com', email_confirmed_at: '2026-09-17T10:00:00Z' });
    await expect(getAccountState()).resolves.toMatchObject({
      kind: 'email',
      email: 'ana@example.com',
      pendingEmail: null,
      recoverable: true,
    });
  });

  it('sin red se responde con la sesión local en vez de dejar la pantalla en blanco', async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { user: user({ is_anonymous: true }) } },
      error: null,
    });
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: Object.assign(new Error('Network request failed'), {
        name: 'AuthRetryableFetchError',
      }),
    });
    await expect(getAccountState()).resolves.toMatchObject({
      kind: 'anonymous',
      userId: 'usuario-1',
    });
  });
});

describe('linkEmailToCurrentUser', () => {
  it('pide la confirmación con el redirect de lockin:// y deja la cuenta pendiente', async () => {
    auth.updateUser.mockResolvedValueOnce({
      data: { user: user({ is_anonymous: true, new_email: 'ana@example.com' }) },
      error: null,
    });
    await expect(linkEmailToCurrentUser('ana@example.com')).resolves.toMatchObject({
      kind: 'pending-email',
      pendingEmail: 'ana@example.com',
      recoverable: false,
    });
    expect(auth.updateUser).toHaveBeenCalledWith(
      { email: 'ana@example.com' },
      { emailRedirectTo: 'lockin://auth/callback' }
    );
  });

  it.each([
    ['email_exists', 'email-in-use', 'ya tiene una cuenta de LockIn'],
    ['email_address_invalid', 'invalid-email', 'no parece válido'],
    ['over_email_send_rate_limit', 'too-many-emails', 'demasiados correos'],
  ])('traduce %s a un error con nombre y con mensaje', async (code, reason, text) => {
    auth.updateUser.mockResolvedValue({ data: { user: null }, error: gotrueError(code) });
    await expect(linkEmailToCurrentUser('ana@example.com')).rejects.toMatchObject({
      name: 'AccountError',
      reason,
    });
    await expect(linkEmailToCurrentUser('ana@example.com')).rejects.toThrow(text);
  });

  it('un fallo de red se cuenta como falta de conexión, no como error de la cuenta', async () => {
    auth.updateUser.mockResolvedValueOnce({
      data: { user: null },
      error: Object.assign(new Error('Network request failed'), {
        name: 'AuthRetryableFetchError',
      }),
    });
    await expect(linkEmailToCurrentUser('ana@example.com')).rejects.toMatchObject({
      reason: 'offline',
    });
  });
});

describe('setAccountPassword', () => {
  it('no pone contraseña mientras el email siga sin confirmar', async () => {
    signedInAs({ is_anonymous: true, new_email: 'ana@example.com' });
    await expect(setAccountPassword('contraseña-larga')).rejects.toMatchObject({
      reason: 'needs-confirmed-email',
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('sin sesión no hay nada que cambiar', async () => {
    auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(setAccountPassword('contraseña-larga')).rejects.toMatchObject({
      reason: 'no-session',
    });
  });

  it('con el email confirmado sí la pone', async () => {
    signedInAs({ email: 'ana@example.com', email_confirmed_at: '2026-09-17T10:00:00Z' });
    auth.updateUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(setAccountPassword('contraseña-larga')).resolves.toBeUndefined();
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'contraseña-larga' });
  });

  it('traduce una contraseña débil', async () => {
    signedInAs({ email: 'ana@example.com', email_confirmed_at: '2026-09-17T10:00:00Z' });
    auth.updateUser.mockResolvedValueOnce({
      data: { user: null },
      error: gotrueError('weak_password'),
    });
    await expect(setAccountPassword('1234')).rejects.toMatchObject({ reason: 'weak-password' });
  });
});

describe('sendPasswordReset', () => {
  it('manda el correo al esquema lockin://', async () => {
    auth.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: null });
    await expect(sendPasswordReset('ana@example.com')).resolves.toBeUndefined();
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('ana@example.com', {
      redirectTo: 'lockin://auth/callback',
    });
  });

  it('traduce el límite de envíos', async () => {
    auth.resetPasswordForEmail.mockResolvedValueOnce({
      data: null,
      error: gotrueError('over_email_send_rate_limit'),
    });
    await expect(sendPasswordReset('ana@example.com')).rejects.toMatchObject({
      reason: 'too-many-emails',
    });
  });
});

describe('completeAuthLink', () => {
  it('canjea el code y, ya recuperable, olvida las credenciales del dispositivo', async () => {
    auth.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    signedInAs({ email: 'ana@example.com', email_confirmed_at: '2026-09-17T10:00:00Z' });
    await expect(
      completeAuthLink('lockin://auth/callback?code=confirmacion')
    ).resolves.toMatchObject({ kind: 'email', recoverable: true });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('confirmacion');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('lockin.supabase.device-account');
  });

  it('acepta también la forma token_hash de las plantillas de correo', async () => {
    auth.verifyOtp.mockResolvedValueOnce({ error: null });
    signedInAs({ email: 'ana@example.com', email_confirmed_at: '2026-09-17T10:00:00Z' });
    await expect(
      completeAuthLink('lockin://auth/callback?token_hash=abc123&type=email_change')
    ).resolves.toMatchObject({ kind: 'email' });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc123', type: 'email_change' });
  });

  it('un enlace caducado se explica en vez de quedarse esperando', async () => {
    const caducado =
      'lockin://auth/callback?error=access_denied&error_description=Email+link+is+invalid';
    await expect(completeAuthLink(caducado)).rejects.toThrow('El enlace ya no sirve');
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('un enlace sin código tampoco pasa por bueno', async () => {
    await expect(completeAuthLink('lockin://auth/callback')).rejects.toThrow(
      'no trae el código de confirmación'
    );
  });

  it('si el canje falla no se borran las credenciales del dispositivo', async () => {
    auth.exchangeCodeForSession.mockResolvedValueOnce({ error: gotrueError('otp_expired') });
    await expect(completeAuthLink('lockin://auth/callback?code=viejo')).rejects.toBeInstanceOf(
      AccountError
    );
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });
});

describe('signOut', () => {
  it.each([
    ['anónima', { is_anonymous: true }],
    [
      'de dispositivo',
      { email: 'device-a1b2c3@lockin.app', email_confirmed_at: '2026-09-17T10:00:00Z' },
    ],
    ['con el email aún sin confirmar', { is_anonymous: true, new_email: 'ana@example.com' }],
  ])('se niega a destruir una cuenta %s', async (_caso, overrides) => {
    signedInAs(overrides);
    await expect(signOut()).rejects.toMatchObject({ reason: 'unrecoverable-account' });
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it('con una cuenta recuperable cierra sesión y olvida el dispositivo', async () => {
    signedInAs({ email: 'ana@example.com', email_confirmed_at: '2026-09-17T10:00:00Z' });
    auth.signOut.mockResolvedValueOnce({ error: null });
    await expect(signOut()).resolves.toBeUndefined();
    expect(auth.signOut).toHaveBeenCalled();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('lockin.supabase.device-account');
  });

  it('acceptDataLoss desbloquea el borrado sin ni siquiera preguntar por el estado', async () => {
    auth.signOut.mockResolvedValueOnce({ error: null });
    await expect(signOut({ acceptDataLoss: true })).resolves.toBeUndefined();
    expect(auth.getSession).not.toHaveBeenCalled();
    expect(auth.signOut).toHaveBeenCalled();
  });
});
