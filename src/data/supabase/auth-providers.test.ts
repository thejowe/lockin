/**
 * Tests de `auth.ts` que no cubre `auth.test.ts`: la cuenta de dispositivo del
 * arranque (cuando el proyecto no deja entrar anónimo), la traducción de los
 * errores de GoTrue, el email y la contraseña, LinkedIn (vincular, sello, vuelta
 * en frío) y entrar con Google o Apple por el navegador.
 *
 * Mismo cliente falso que `auth.test.ts`; el almacén seguro es un `Map`, porque
 * aquí importa qué cuenta de dispositivo queda guardada, no cómo se trocea en
 * `expo-secure-store` (eso lo prueba `secure-storage.test.ts`).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import {
  AccountError,
  adoptLinkedinIdentity,
  changeAccountPassword,
  completeAuthLink,
  currentSignInProvider,
  ensureUserId,
  isRecoveringPassword,
  linkLinkedinIdentity,
  signInWithEmail,
  signInWithProvider,
  signUpWithEmail,
  unlinkLinkedinIdentity,
} from './auth';
import { getSupabaseClient, peekSupabaseClient } from './client';
import { secureAuthStorage } from './secure-storage';

jest.mock('./client', () => ({ getSupabaseClient: jest.fn(), peekSupabaseClient: jest.fn() }));
jest.mock('./secure-storage', () => {
  const store = new Map<string, string>();
  return {
    secureAuthStorage: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      clear: () => store.clear(),
    },
  };
});
jest.mock('expo-linking', () => ({ createURL: jest.fn() }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

const auth = {
  getSession: jest.fn(),
  getUser: jest.fn(),
  signInAnonymously: jest.fn(),
  signInWithPassword: jest.fn(),
  signUp: jest.fn(),
  updateUser: jest.fn(),
  linkIdentity: jest.fn(),
  exchangeCodeForSession: jest.fn(),
  getUserIdentities: jest.fn(),
  unlinkIdentity: jest.fn(),
  signInWithIdToken: jest.fn(),
  signInWithOAuth: jest.fn(),
};
const rpc = jest.fn();

const DEVICE_ACCOUNT_KEY = 'lockin.supabase.device-account';
const LINKEDIN_ATTEMPT_KEY = 'lockin.supabase.linkedin-attempt';
const PASSWORD_RECOVERY_KEY = 'lockin.supabase.password-recovery';

const storage = secureAuthStorage as typeof secureAuthStorage & { clear: () => void };

/** Un error de GoTrue tal y como llega: lo que importa es el `code`. */
function gotrueError(code: string, message = 'error del servidor') {
  return Object.assign(new Error(message), { code, status: 422 });
}

/** Sin sesión guardada: `ensureUserId` tiene que abrir una. */
function noSession() {
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
}

/** El proyecto con "Anonymous sign-ins" apagado. */
function anonymousDisabled() {
  auth.signInAnonymously.mockResolvedValue({
    data: { user: null },
    error: gotrueError('anonymous_provider_disabled'),
  });
}

function identities(...providers: string[]) {
  auth.getUserIdentities.mockResolvedValue({
    data: { identities: providers.map((provider) => ({ provider, id: `${provider}-id` })) },
    error: null,
  });
}

/** El code del navegador, distinto en cada test: `oauth.ts` recuerda cada canje. */
let code = '';
let codes = 0;

const originalOS = Platform.OS;

beforeEach(async () => {
  code = `oauth-code-${++codes}`;
  await AsyncStorage.clear();
  storage.clear();
  jest.clearAllMocks();
  Platform.OS = 'android';
  jest.mocked(Linking.createURL).mockReturnValue('cofounder://auth/callback');
  auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
  rpc.mockResolvedValue({ error: null });
  identities('email');
  jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({
    type: 'success',
    url: `cofounder://auth/callback?code=${code}`,
  });
  const shared = { auth, rpc } as unknown as ReturnType<typeof getSupabaseClient>;
  jest.mocked(getSupabaseClient).mockReturnValue(shared);
  jest.mocked(peekSupabaseClient).mockReturnValue(shared);
});

afterEach(() => {
  Platform.OS = originalOS;
});

describe('ensureUserId sin sesión', () => {
  it('entra anónimo si el proyecto lo permite, sin cuenta de dispositivo', async () => {
    noSession();
    auth.signInAnonymously.mockResolvedValue({ data: { user: { id: 'anon-1' } }, error: null });

    await expect(ensureUserId()).resolves.toBe('anon-1');
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('dos consultas a la vez abren una sola sesión', async () => {
    noSession();
    auth.signInAnonymously.mockResolvedValue({ data: { user: { id: 'anon-1' } }, error: null });

    await expect(Promise.all([ensureUserId(), ensureUserId()])).resolves.toEqual([
      'anon-1',
      'anon-1',
    ]);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('sin anónimos, crea una cuenta de dispositivo aleatoria y la guarda', async () => {
    noSession();
    anonymousDisabled();
    auth.signUp.mockResolvedValue({
      data: { user: { id: 'device-1' }, session: { access_token: 't' } },
      error: null,
    });

    await expect(ensureUserId()).resolves.toBe('device-1');

    const account = auth.signUp.mock.calls[0][0] as { email: string; password: string };
    expect(account.email).toMatch(/^device-[0-9a-f]{24}@lockin\.app$/);
    expect(account.password).toMatch(/^[0-9a-f]{48}$/);
    expect(JSON.parse((await storage.getItem(DEVICE_ACCOUNT_KEY)) as string)).toEqual(account);
    // `signUp` ya dejó sesión: no hace falta entrar otra vez.
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('si el alta no deja sesión, entra con las credenciales recién creadas', async () => {
    noSession();
    anonymousDisabled();
    auth.signUp.mockResolvedValue({
      data: { user: { id: 'device-1' }, session: null },
      error: null,
    });
    auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'device-1' } }, error: null });

    await expect(ensureUserId()).resolves.toBe('device-1');
    expect(auth.signInWithPassword).toHaveBeenCalledWith(auth.signUp.mock.calls[0][0]);
  });

  it('si ese login falla, el error sube', async () => {
    noSession();
    anonymousDisabled();
    auth.signUp.mockResolvedValue({
      data: { user: { id: 'device-1' }, session: null },
      error: null,
    });
    const failure = gotrueError('invalid_credentials');
    auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: failure });

    await expect(ensureUserId()).rejects.toBe(failure);
  });

  it('con "Confirm email" activado lo explica en vez de arrancar sin sesión', async () => {
    noSession();
    anonymousDisabled();
    auth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: null });

    await expect(ensureUserId()).rejects.toThrow(/Confirm email/);
    expect(await storage.getItem(DEVICE_ACCOUNT_KEY)).toBeNull();
  });

  it('propaga un alta rechazada', async () => {
    noSession();
    anonymousDisabled();
    const failure = gotrueError('signup_disabled');
    auth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: failure });

    await expect(ensureUserId()).rejects.toBe(failure);
  });

  it('reutiliza la cuenta de dispositivo guardada', async () => {
    noSession();
    anonymousDisabled();
    const saved = { email: 'device-abc@lockin.app', password: 'secreta' };
    await storage.setItem(DEVICE_ACCOUNT_KEY, JSON.stringify(saved));
    auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'device-0' } }, error: null });

    await expect(ensureUserId()).resolves.toBe('device-0');
    expect(auth.signInWithPassword).toHaveBeenCalledWith(saved);
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('si las credenciales guardadas ya no valen, crea otra cuenta', async () => {
    noSession();
    anonymousDisabled();
    await storage.setItem(
      DEVICE_ACCOUNT_KEY,
      JSON.stringify({ email: 'device-old@lockin.app', password: 'vieja' })
    );
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: gotrueError('invalid_credentials'),
    });
    auth.signUp.mockResolvedValue({
      data: { user: { id: 'device-2' }, session: { access_token: 't' } },
      error: null,
    });

    await expect(ensureUserId()).resolves.toBe('device-2');
    expect(auth.signUp).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['corrupta', '{no es json'],
    ['con otra forma', JSON.stringify({ email: 'device-x@lockin.app' })],
    ['nula', 'null'],
  ])('una entrada guardada %s se descarta', async (_label, stored) => {
    noSession();
    anonymousDisabled();
    await storage.setItem(DEVICE_ACCOUNT_KEY, stored);
    auth.signUp.mockResolvedValue({
      data: { user: { id: 'device-3' }, session: { access_token: 't' } },
      error: null,
    });

    await expect(ensureUserId()).resolves.toBe('device-3');
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('sin crypto.getRandomValues no se inventa una contraseña adivinable', async () => {
    noSession();
    anonymousDisabled();
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      await expect(ensureUserId()).rejects.toThrow(/crypto\.getRandomValues/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
    }
    expect(auth.signUp).not.toHaveBeenCalled();
  });
});

describe('errores de GoTrue traducidos', () => {
  it.each([
    ['LI007', 'no-session'],
    ['email_exists', 'email-in-use'],
    ['user_already_exists', 'email-in-use'],
    ['weak_password', 'weak-password'],
    ['email_address_invalid', 'invalid-email'],
    ['validation_failed', 'invalid-email'],
    ['same_password', 'same-password'],
    ['over_email_send_rate_limit', 'too-many-emails'],
    ['over_request_rate_limit', 'too-many-emails'],
    ['email_not_confirmed', 'needs-confirmed-email'],
    ['codigo_desconocido', 'unknown'],
  ])('%s → %s', async (errorCode, reason) => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: gotrueError(errorCode) });

    const failure = await signInWithEmail('ana@example.com', 'x').catch((cause: unknown) => cause);

    expect(failure).toBeInstanceOf(AccountError);
    expect(failure).toMatchObject({ reason });
  });

  it('sin respuesta del servidor es falta de conexión', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: Object.assign(new Error('Failed to fetch'), { name: 'AuthRetryableFetchError' }),
    });

    await expect(signInWithEmail('ana@example.com', 'x')).rejects.toMatchObject({
      reason: 'offline',
    });
  });

  it('un error desconocido conserva su mensaje, y uno que no es Error dice que es desconocido', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: new Error('raro') });
    await expect(signInWithEmail('ana@example.com', 'x')).rejects.toMatchObject({
      reason: 'unknown',
      message: 'raro',
    });

    auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: 'texto suelto' });
    await expect(signInWithEmail('ana@example.com', 'x')).rejects.toMatchObject({
      reason: 'unknown',
      message: 'Error desconocido en la cuenta.',
    });
  });

  it('un AccountError ya traducido pasa tal cual', async () => {
    const original = new AccountError('offline', 'ya traducido');
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: original });

    await expect(signInWithEmail('ana@example.com', 'x')).rejects.toBe(original);
  });
});

describe('email y contraseña', () => {
  it('signInWithEmail devuelve el uid de la cuenta', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u-ana' } }, error: null });

    await expect(signInWithEmail('ana@example.com', 'pw')).resolves.toBe('u-ana');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'pw',
    });
  });

  it('signUpWithEmail da de alta y apunta el correo pedido, que habilita su token_hash', async () => {
    auth.signUp.mockResolvedValue({ data: { user: { id: 'u-nueva' } }, error: null });

    await expect(signUpWithEmail('nueva@example.com', 'pw')).resolves.toBe('u-nueva');
    expect(
      Number(await AsyncStorage.getItem('lockin.supabase.email-link-request'))
    ).toBeGreaterThan(0);
  });

  it('signUpWithEmail sin usuario devuelto da null, y un rechazo se traduce', async () => {
    auth.signUp.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(signUpWithEmail('nueva@example.com', 'pw')).resolves.toBeNull();

    auth.signUp.mockResolvedValueOnce({ data: { user: null }, error: gotrueError('email_exists') });
    await expect(signUpWithEmail('nueva@example.com', 'pw')).rejects.toMatchObject({
      reason: 'email-in-use',
    });
  });

  it('changeAccountPassword sin sesión no intenta nada', async () => {
    noSession();

    await expect(changeAccountPassword('vieja', 'nueva')).rejects.toMatchObject({
      reason: 'no-session',
    });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('changeAccountPassword traduce un fallo que no es la contraseña equivocada', async () => {
    const current = {
      id: 'u-ana',
      email: 'ana@example.com',
      new_email: null,
      email_confirmed_at: '2026-10-01T00:00:00Z',
    };
    auth.getSession.mockResolvedValue({ data: { session: { user: current } }, error: null });
    auth.getUser.mockResolvedValue({ data: { user: current }, error: null });
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: gotrueError('over_request_rate_limit'),
    });

    await expect(changeAccountPassword('vieja', 'nueva')).rejects.toMatchObject({
      reason: 'too-many-emails',
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('isRecoveringPassword con una marca ilegible responde que no', async () => {
    await AsyncStorage.setItem(PASSWORD_RECOVERY_KEY, '{rota');

    await expect(isRecoveringPassword()).resolves.toBe(false);
  });
});

describe('currentSignInProvider', () => {
  it('dice con qué proveedor entró la sesión', async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { user: { app_metadata: { provider: 'google' } } } },
      error: null,
    });

    await expect(currentSignInProvider()).resolves.toBe('google');
  });

  it('sin sesión, o sin proveedor, null', async () => {
    noSession();
    await expect(currentSignInProvider()).resolves.toBeNull();

    auth.getSession.mockResolvedValue({
      data: { session: { user: { app_metadata: {} } } },
      error: null,
    });
    await expect(currentSignInProvider()).resolves.toBeNull();
  });
});

describe('enabledAuthProviders', () => {
  const original = process.env.EXPO_PUBLIC_AUTH_PROVIDERS;
  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_AUTH_PROVIDERS;
    else process.env.EXPO_PUBLIC_AUTH_PROVIDERS = original;
  });

  it('solo enciende los proveedores conocidos de la lista, sin mayúsculas ni espacios', () => {
    process.env.EXPO_PUBLIC_AUTH_PROVIDERS = ' Google, apple ,facebook,,LINKEDIN';
    jest.isolateModules(() => {
      const { enabledAuthProviders } = require('./auth') as typeof import('./auth');
      expect([...enabledAuthProviders].sort()).toEqual(['apple', 'google', 'linkedin']);
    });
  });

  it('sin la variable no hay ninguno', () => {
    delete process.env.EXPO_PUBLIC_AUTH_PROVIDERS;
    jest.isolateModules(() => {
      const { enabledAuthProviders } = require('./auth') as typeof import('./auth');
      expect(enabledAuthProviders.size).toBe(0);
    });
  });
});

describe('LinkedIn', () => {
  beforeEach(() => {
    auth.linkIdentity.mockResolvedValue({
      data: { url: 'https://www.linkedin.com/oauth' },
      error: null,
    });
  });

  describe('adoptLinkedinIdentity', () => {
    it('sin LinkedIn vinculado no toca el sello', async () => {
      await expect(adoptLinkedinIdentity()).resolves.toBe(false);
      expect(rpc).not.toHaveBeenCalled();
    });

    it('con LinkedIn vinculado pone el sello en Postgres', async () => {
      identities('email', 'linkedin_oidc');

      await expect(adoptLinkedinIdentity()).resolves.toBe(true);
      expect(rpc).toHaveBeenCalledWith('sync_linkedin_verification');
    });

    it('propaga un fallo al leer identidades o al sellar', async () => {
      const readFailure = new Error('identidades');
      auth.getUserIdentities.mockResolvedValueOnce({ data: null, error: readFailure });
      await expect(adoptLinkedinIdentity()).rejects.toBe(readFailure);

      identities('linkedin_oidc');
      const rpcFailure = new Error('rpc');
      rpc.mockResolvedValueOnce({ error: rpcFailure });
      await expect(adoptLinkedinIdentity()).rejects.toBe(rpcFailure);
    });
  });

  describe('linkLinkedinIdentity', () => {
    it('ya vinculado de una vuelta perdida: sella sin abrir el navegador', async () => {
      identities('email', 'linkedin_oidc');

      await expect(linkLinkedinIdentity()).resolves.toBe(true);
      expect(auth.linkIdentity).not.toHaveBeenCalled();
      expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
    });

    it('vincula LinkedIn a la cuenta actual, canjea el code y pone el sello', async () => {
      auth.exchangeCodeForSession.mockImplementation(async () => {
        identities('email', 'linkedin_oidc');
        return { data: {}, error: null };
      });

      await expect(linkLinkedinIdentity()).resolves.toBe(true);

      expect(auth.linkIdentity).toHaveBeenCalledWith({
        provider: 'linkedin_oidc',
        options: { redirectTo: 'cofounder://auth/callback', skipBrowserRedirect: true },
      });
      expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
        'https://www.linkedin.com/oauth',
        'cofounder://auth/callback'
      );
      expect(auth.exchangeCodeForSession).toHaveBeenCalledWith(code);
      expect(rpc).toHaveBeenCalledWith('sync_linkedin_verification');
      // El intento se cierra al volver: no queda nada para la vuelta en frío.
      expect(await AsyncStorage.getItem(LINKEDIN_ATTEMPT_KEY)).toBeNull();
    });

    it('cerrar el navegador es cancelar y no sella nada', async () => {
      jest
        .mocked(WebBrowser.openAuthSessionAsync)
        .mockResolvedValue({ type: 'cancel' as WebBrowser.WebBrowserResultType });

      await expect(linkLinkedinIdentity()).resolves.toBe(false);
      expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
      expect(rpc).not.toHaveBeenCalled();
      expect(await AsyncStorage.getItem(LINKEDIN_ATTEMPT_KEY)).toBeNull();
    });

    it('sin "Enable Manual Linking" dice dónde activarlo', async () => {
      auth.linkIdentity.mockResolvedValue({
        data: {},
        error: new Error('Manual linking is disabled'),
      });

      await expect(linkLinkedinIdentity()).rejects.toThrow(/Enable Manual Linking/);
      expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
    });

    it('un LinkedIn de otro perfil se explica', async () => {
      auth.linkIdentity.mockResolvedValue({
        data: {},
        error: new Error('Identity is already linked to another user'),
      });

      await expect(linkLinkedinIdentity()).rejects.toThrow(/ya está vinculada a otro perfil/);
    });

    it('cualquier otro error del servidor sube tal cual', async () => {
      const failure = new Error('500');
      auth.linkIdentity.mockResolvedValue({ data: {}, error: failure });

      await expect(linkLinkedinIdentity()).rejects.toBe(failure);
    });

    it('un canje fallido es un error, y el intento se cierra igual', async () => {
      const failure = new Error('code gastado');
      auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: failure });

      await expect(linkLinkedinIdentity()).rejects.toBe(failure);
      expect(rpc).not.toHaveBeenCalled();
      expect(await AsyncStorage.getItem(LINKEDIN_ATTEMPT_KEY)).toBeNull();
    });

    it('si el canje no deja LinkedIn vinculado, no lo da por bueno', async () => {
      await expect(linkLinkedinIdentity()).rejects.toThrow(/no ha quedado vinculado/);
      expect(rpc).not.toHaveBeenCalled();
    });

    it('un error que devuelve LinkedIn en la URL sube con su texto', async () => {
      jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({
        type: 'success',
        url: 'cofounder://auth/callback?error=access_denied&error_description=Usuario+cancel%C3%B3',
      });

      await expect(linkLinkedinIdentity()).rejects.toThrow('Usuario canceló');
      expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    });
  });

  describe('la vuelta de LinkedIn en frío', () => {
    beforeEach(() => {
      auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'u1', email: null, is_anonymous: true } } },
        error: null,
      });
      auth.getUser.mockResolvedValue({
        data: { user: { id: 'u1', email: null, is_anonymous: true } },
        error: null,
      });
    });

    it('con un intento abierto, la ruta de callback canjea el code y pone el sello', async () => {
      await AsyncStorage.setItem(LINKEDIN_ATTEMPT_KEY, String(Date.now()));
      identities('email', 'linkedin_oidc');

      await expect(
        completeAuthLink(`cofounder://auth/callback?code=${code}`)
      ).resolves.toMatchObject({ userId: 'u1' });

      expect(auth.exchangeCodeForSession).toHaveBeenCalledWith(code);
      expect(rpc).toHaveBeenCalledWith('sync_linkedin_verification');
      expect(await AsyncStorage.getItem(LINKEDIN_ATTEMPT_KEY)).toBeNull();
    });

    it('si el sello falla, dice que LinkedIn quedó vinculado y cómo terminar', async () => {
      await AsyncStorage.setItem(LINKEDIN_ATTEMPT_KEY, String(Date.now()));
      identities('linkedin_oidc');
      rpc.mockResolvedValue({ error: new Error('rpc caído') });

      await expect(completeAuthLink(`cofounder://auth/callback?code=${code}`)).rejects.toThrow(
        /no hemos podido poner el sello/
      );
    });

    it('un intento caducado no pregunta por identidades', async () => {
      await AsyncStorage.setItem(LINKEDIN_ATTEMPT_KEY, String(Date.now() - 11 * 60 * 1000));

      await completeAuthLink(`cofounder://auth/callback?code=${code}`);

      expect(auth.getUserIdentities).not.toHaveBeenCalled();
      expect(rpc).not.toHaveBeenCalled();
    });

    it('si no se puede leer el intento, se trata como que no lo hay', async () => {
      const getItem = jest.mocked(AsyncStorage.getItem);
      const original = getItem.getMockImplementation();
      getItem.mockImplementation(async (key: string) => {
        if (key === LINKEDIN_ATTEMPT_KEY) throw new Error('almacén roto');
        return null;
      });
      try {
        await completeAuthLink(`cofounder://auth/callback?code=${code}`);
      } finally {
        getItem.mockImplementation(original);
      }

      expect(rpc).not.toHaveBeenCalled();
    });
  });

  describe('unlinkLinkedinIdentity', () => {
    it('desvincula solo LinkedIn y apaga el sello', async () => {
      identities('email', 'linkedin_oidc');
      auth.unlinkIdentity.mockResolvedValue({ error: null });

      await expect(unlinkLinkedinIdentity()).resolves.toBeUndefined();

      expect(auth.unlinkIdentity).toHaveBeenCalledWith({
        provider: 'linkedin_oidc',
        id: 'linkedin_oidc-id',
      });
      expect(rpc).toHaveBeenCalledWith('sync_linkedin_verification');
    });

    it('sin LinkedIn vinculado solo apaga el sello', async () => {
      await expect(unlinkLinkedinIdentity()).resolves.toBeUndefined();

      expect(auth.unlinkIdentity).not.toHaveBeenCalled();
      expect(rpc).toHaveBeenCalledWith('sync_linkedin_verification');
    });

    it('propaga cada fallo por el camino', async () => {
      const readFailure = new Error('identidades');
      auth.getUserIdentities.mockResolvedValueOnce({ data: null, error: readFailure });
      await expect(unlinkLinkedinIdentity()).rejects.toBe(readFailure);

      identities('linkedin_oidc');
      const unlinkFailure = new Error('unlink');
      auth.unlinkIdentity.mockResolvedValueOnce({ error: unlinkFailure });
      await expect(unlinkLinkedinIdentity()).rejects.toBe(unlinkFailure);

      auth.unlinkIdentity.mockResolvedValueOnce({ error: null });
      const syncFailure = new Error('sync');
      rpc.mockResolvedValueOnce({ error: syncFailure });
      await expect(unlinkLinkedinIdentity()).rejects.toBe(syncFailure);
    });
  });
});

describe('signInWithProvider por el navegador', () => {
  beforeEach(() => {
    auth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/o/oauth2' },
      error: null,
    });
  });

  it('Google abre una sesión nueva y canjea el code una sola vez', async () => {
    await expect(signInWithProvider('google')).resolves.toBe(true);

    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'cofounder://auth/callback', skipBrowserRedirect: true },
    });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith(code);
  });

  it('la misma vuelta por la ruta de callback espera ese canje en vez de repetirlo', async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u-google', email: null } } },
      error: null,
    });
    auth.getUser.mockResolvedValue({
      data: { user: { id: 'u-google', email: null } },
      error: null,
    });

    await signInWithProvider('google');
    await expect(completeAuthLink(`cofounder://auth/callback?code=${code}`)).resolves.toMatchObject(
      { userId: 'u-google' }
    );

    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it('Apple fuera de iOS va por el navegador, no por la hoja nativa', async () => {
    await expect(signInWithProvider('apple')).resolves.toBe(true);

    expect(AppleAuthentication.signInAsync).not.toHaveBeenCalled();
    expect(auth.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'apple' })
    );
  });

  it('cerrar el navegador es cancelar', async () => {
    jest
      .mocked(WebBrowser.openAuthSessionAsync)
      .mockResolvedValue({ type: 'dismiss' as WebBrowser.WebBrowserResultType });

    await expect(signInWithProvider('google')).resolves.toBe(false);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('un proveedor apagado en el dashboard se traduce', async () => {
    auth.signInWithOAuth.mockResolvedValue({
      data: {},
      error: gotrueError('over_request_rate_limit'),
    });

    await expect(signInWithProvider('google')).rejects.toMatchObject({
      reason: 'too-many-emails',
    });
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('un canje fallido se traduce', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({
      data: {},
      error: Object.assign(new Error('sin red'), { name: 'AuthRetryableFetchError' }),
    });

    await expect(signInWithProvider('google')).rejects.toMatchObject({ reason: 'offline' });
  });

  it('un 500 del servidor no se cuenta como falta de red', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({
      data: {},
      error: Object.assign(new Error('Internal Server Error'), {
        name: 'AuthRetryableFetchError',
        status: 500,
      }),
    });

    await expect(signInWithProvider('google')).rejects.toMatchObject({ reason: 'unknown' });
  });

  it('un email repartido entre dos cuentas dice qué pasa, venga del canje o de la vuelta', async () => {
    const conflict =
      'Multiple accounts with the same email address in the same linking domain detected: default';
    auth.exchangeCodeForSession.mockResolvedValue({
      data: {},
      error: Object.assign(new Error(conflict), { name: 'AuthRetryableFetchError', status: 500 }),
    });
    await expect(signInWithProvider('google')).rejects.toMatchObject({
      reason: 'email-in-use',
      message: expect.stringMatching(/otra cuenta de cofounder/),
    });

    jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({
      type: 'success',
      url: `cofounder://auth/callback?error=server_error&error_description=${encodeURIComponent(conflict)}`,
    });
    await expect(signInWithProvider('google')).rejects.toMatchObject({ reason: 'email-in-use' });
  });

  it('una vuelta sin code es un error, no una sesión', async () => {
    jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({
      type: 'success',
      url: 'cofounder://auth/callback',
    });

    await expect(signInWithProvider('google')).rejects.toThrow(/no devolvió el código/);
  });

  it('en iOS, un fallo de la hoja de Apple que no es cancelar sube', async () => {
    Platform.OS = 'ios';
    const failure = Object.assign(new Error('sin Apple ID'), { code: 'ERR_REQUEST_UNKNOWN' });
    jest.mocked(AppleAuthentication.signInAsync).mockRejectedValue(failure);

    await expect(signInWithProvider('apple')).rejects.toBe(failure);
  });
});
