import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import {
  AccountError,
  adoptLinkedGithubIdentity,
  completeAuthLink,
  currentUserId,
  deleteMyAccount,
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
const rpc = jest.fn();

/** Donde `auth.ts` deja abierto el intento de GitHub por si el proceso muere. */
const GITHUB_ATTEMPT_KEY = 'lockin.supabase.github-link-attempt';

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

/**
 * El code que devuelve el navegador, distinto en cada test: `auth.ts` recuerda
 * el canje de cada code de GitHub mientras vive el módulo, como en la app.
 */
let githubCode = '';
let githubCodes = 0;

beforeEach(async () => {
  githubCode = `one-use-code-${++githubCodes}`;
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest.mocked(Linking.createURL).mockReturnValue('lockin://auth/callback');
  auth.linkIdentity.mockResolvedValue({
    data: { url: 'https://github.com/login/oauth' },
    error: null,
  });
  auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  auth.getUserIdentities.mockResolvedValue({
    data: { identities: [{ provider: 'email' }, { provider: 'github' }] },
    error: null,
  });
  rpc.mockResolvedValue({ error: null });
  jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({
    type: 'success',
    url: `lockin://auth/callback?code=${githubCode}`,
  });
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue({ auth, rpc } as unknown as ReturnType<typeof getSupabaseClient>);
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

describe('adoptLinkedGithubIdentity', () => {
  it('con GitHub ya vinculado y sin sello, lo pone sin abrir el navegador', async () => {
    // Una vuelta en frío perdida deja la identidad en GoTrue y el sello sin poner.
    await AsyncStorage.setItem(GITHUB_ATTEMPT_KEY, JSON.stringify({ startedAt: 1 }));

    await expect(adoptLinkedGithubIdentity()).resolves.toBe(true);

    expect(rpc).toHaveBeenCalledWith('sync_github_verification');
    expect(auth.linkIdentity).not.toHaveBeenCalled();
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(GITHUB_ATTEMPT_KEY)).toBeNull();
  });

  it('sin GitHub vinculado no llama al RPC, que vaciaría el enlace escrito a mano', async () => {
    withoutGithubIdentity();

    await expect(adoptLinkedGithubIdentity()).resolves.toBe(false);

    expect(rpc).not.toHaveBeenCalled();
  });

  it('propaga un fallo del RPC', async () => {
    const error = new Error('sin red');
    rpc.mockResolvedValueOnce({ error });

    await expect(adoptLinkedGithubIdentity()).rejects.toBe(error);
  });
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
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith(githubCode);
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
    withoutGithubIdentity();
    await expect(linkGithubIdentity()).rejects.toBe(error);
  });

  it('un canje fallido no pasa por bueno aunque la cuenta ya tenga GitHub', async () => {
    const error = gotrueError('flow_state_not_found', 'invalid flow state');
    auth.exchangeCodeForSession.mockResolvedValueOnce({ error });
    await expect(linkGithubIdentity()).rejects.toBe(error);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('pone el sello en cuanto GitHub queda vinculado', async () => {
    await expect(linkGithubIdentity()).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('sync_github_verification');
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('si el canje no deja GitHub vinculado no pisa el enlace escrito a mano', async () => {
    // El RPC sin identidad de GitHub vacía `link_github`: solo se llama con ella.
    withoutGithubIdentity();
    await expect(linkGithubIdentity()).rejects.toThrow('GitHub no ha quedado vinculado');
    expect(rpc).not.toHaveBeenCalled();
  });
});

/*
 * En Android la vuelta de GitHub resuelve `openAuthSessionAsync` y ADEMÁS abre la
 * ruta `auth/callback`, que pasa el mismo `code` —de un solo uso— a
 * `completeAuthLink`. Canjearlo dos veces hacía que uno de los dos fallara y la
 * pantalla dijera «Ese enlace no ha funcionado» con el sello ya puesto
 * (comprobador, 2026-10-01). Revisión del 2026-10-02: los dos tienen que
 * compartir el MISMO canje —y su resultado—, en los dos órdenes.
 */
describe('la vuelta de GitHub por la ruta de callback', () => {
  it('navegador primero: la ruta espera al canje en curso y no canjea otra vez', async () => {
    const exchange = deferred<{ error: Error | null }>();
    auth.exchangeCodeForSession.mockReturnValueOnce(exchange.promise);
    browserReturns('g-nav-diferido');
    signedInAs({ is_anonymous: true });

    const linking = linkGithubIdentity();
    await until(() => auth.exchangeCodeForSession.mock.calls.length > 0);
    const route = track(completeAuthLink(callback('g-nav-diferido')));
    await flush();
    expect(route.settled).toBe(false);

    exchange.resolve({ error: null });
    await expect(linking).resolves.toBe(true);
    await expect(route.promise).resolves.toMatchObject({ kind: 'anonymous' });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith('lockin.supabase.device-account');
  });

  it('navegador primero: si el canje falla, la ruta también lo dice', async () => {
    const exchange = deferred<{ error: Error | null }>();
    auth.exchangeCodeForSession.mockReturnValueOnce(exchange.promise);
    browserReturns('g-nav-rechazado');
    withoutGithubIdentity();

    const linking = linkGithubIdentity();
    linking.catch(() => {});
    await until(() => auth.exchangeCodeForSession.mock.calls.length > 0);
    const route = completeAuthLink(callback('g-nav-rechazado'));
    route.catch(() => {});

    const caducado = gotrueError('flow_state_not_found', 'invalid flow state');
    exchange.resolve({ error: caducado });
    await expect(linking).rejects.toBe(caducado);
    await expect(route).rejects.toMatchObject({ name: 'AccountError', github: true });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('ruta primero: espera al navegador y comparte su canje', async () => {
    const browser = pendingBrowser();
    const exchange = deferred<{ error: Error | null }>();
    auth.exchangeCodeForSession.mockReturnValueOnce(exchange.promise);
    signedInAs({ is_anonymous: true });

    const linking = linkGithubIdentity();
    await waitForBrowser();
    const route = track(completeAuthLink(callback('g-ruta-diferido')));
    await flush();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();

    browser.finish({ type: 'success', url: callback('g-ruta-diferido') });
    await until(() => auth.exchangeCodeForSession.mock.calls.length > 0);
    await flush();
    expect(route.settled).toBe(false);

    exchange.resolve({ error: null });
    await expect(linking).resolves.toBe(true);
    await expect(route.promise).resolves.toMatchObject({ kind: 'anonymous' });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('g-ruta-diferido');
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('ruta primero: si el canje falla, los dos lo dicen y nadie lo repite', async () => {
    const browser = pendingBrowser();
    const exchange = deferred<{ error: Error | null }>();
    auth.exchangeCodeForSession.mockReturnValueOnce(exchange.promise);
    withoutGithubIdentity();

    const linking = linkGithubIdentity();
    linking.catch(() => {});
    await waitForBrowser();
    const route = completeAuthLink(callback('g-ruta-rechazado'));
    route.catch(() => {});

    browser.finish({ type: 'success', url: callback('g-ruta-rechazado') });
    const caducado = gotrueError('flow_state_not_found', 'invalid flow state');
    exchange.resolve({ error: caducado });
    await expect(linking).rejects.toBe(caducado);
    await expect(route).rejects.toMatchObject({ name: 'AccountError', github: true });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('con GitHub abierto, el code de un correo se sigue canjeando como correo', async () => {
    const browser = pendingBrowser();
    signedInAs({ email: 'ana@example.com', email_confirmed_at: '2026-09-17T10:00:00Z' });
    withoutGithubIdentity();

    const linking = linkGithubIdentity();
    await waitForBrowser();
    const route = completeAuthLink(callback('correo-con-github-abierto'));

    browser.finish({ type: 'cancel' as WebBrowser.WebBrowserResultType.CANCEL });
    await expect(linking).resolves.toBe(false);
    await expect(route).resolves.toMatchObject({ kind: 'email', recoverable: true });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('correo-con-github-abierto');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('lockin.supabase.device-account');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('acabada la vinculación, un enlace de correo se sigue canjeando', async () => {
    await linkGithubIdentity();
    signedInAs({ email: 'ana@example.com', email_confirmed_at: '2026-09-17T10:00:00Z' });
    await completeAuthLink(callback('correo-nuevo'));
    expect(auth.exchangeCodeForSession).toHaveBeenLastCalledWith('correo-nuevo');
  });

  it('sin intento de GitHub, un code de correo no toca el sello', async () => {
    signedInAs({ email: 'ana@example.com', email_confirmed_at: '2026-09-17T10:00:00Z' });
    await completeAuthLink(callback('correo-sin-github'));
    expect(auth.getUserIdentities).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});

/*
 * Vuelta en frío: Android mata el proceso con GitHub delante, y la vuelta abre
 * la app desde cero. Ya no hay navegador que espere a nadie: solo la ruta, con un
 * code que canjea el verificador PKCE que supabase-js dejó en AsyncStorage.
 */
describe('la vuelta de GitHub en frío', () => {
  /** Empieza la vinculación y deja GitHub abierto, como cuando Android mata el proceso. */
  async function githubOpenWhenProcessDies() {
    const browser = pendingBrowser();
    const linking = linkGithubIdentity();
    linking.catch(() => {});
    await waitForBrowser();
    await until(() => jest.mocked(AsyncStorage.setItem).mock.calls.length > 0);
    // El proceso viejo no vuelve: se cierra su navegador para no dejar a este
    // módulo con un intento abierto entre tests, pero ya sin AsyncStorage.
    return async () => {
      const storage = await AsyncStorage.getItem(GITHUB_ATTEMPT_KEY);
      browser.finish({ type: 'dismiss' as WebBrowser.WebBrowserResultType.DISMISS });
      await linking.catch(() => {});
      if (storage) await AsyncStorage.setItem(GITHUB_ATTEMPT_KEY, storage);
    };
  }

  it('la ruta canjea el code y pone el sello', async () => {
    const forgetOldProcess = await githubOpenWhenProcessDies();
    await forgetOldProcess();
    jest.clearAllMocks();
    const fresh = restartProcess();
    signedInAs({ is_anonymous: true });

    await expect(fresh.completeAuthLink(callback('g-frio'))).resolves.toMatchObject({
      kind: 'anonymous',
    });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('g-frio');
    expect(rpc).toHaveBeenCalledWith('sync_github_verification');
  });

  // Revisión del 2026-10-02 (codex review, P2): que la cuenta tenga GitHub no
  // prueba que ESTE code lo vinculara. Un correo caducado con un intento
  // abierto se aceptaba como éxito y se saltaba la confirmación en silencio.
  it('un canje fallido con un intento abierto sigue siendo un error aunque haya GitHub', async () => {
    const forgetOldProcess = await githubOpenWhenProcessDies();
    await forgetOldProcess();
    jest.clearAllMocks();
    const fresh = restartProcess();
    signedInAs({ is_anonymous: true });
    auth.exchangeCodeForSession.mockResolvedValue({
      error: gotrueError('otp_expired', 'Email link is invalid or has expired'),
    });

    await expect(fresh.completeAuthLink(callback('correo-caducado'))).rejects.toBeInstanceOf(
      fresh.AccountError
    );
    expect(rpc).not.toHaveBeenCalled();

    // Y no queda apuntado como gastado: reabrirlo sigue fallando, no pasa por bueno.
    await expect(
      restartProcess().completeAuthLink(callback('correo-caducado'))
    ).rejects.toBeDefined();
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(2);
  });

  // codex review, P2: el canje fue bien, pero si poner el sello falla, la
  // pantalla no puede decir «Tu cuenta no ha cambiado»: GitHub ya está vinculado.
  it.each([
    [
      'la consulta de identidades',
      () => auth.getUserIdentities.mockResolvedValue({ data: null, error: new Error('Sin red') }),
    ],
    ['el RPC del sello', () => rpc.mockResolvedValue({ error: new Error('Sin red') })],
  ])('en frío, si falla %s tras el canje, el error es de GitHub', async (_caso, breakIt) => {
    const forgetOldProcess = await githubOpenWhenProcessDies();
    await forgetOldProcess();
    jest.clearAllMocks();
    const fresh = restartProcess();
    signedInAs({ is_anonymous: true });
    breakIt();

    await expect(fresh.completeAuthLink(callback('g-frio-sin-sello'))).rejects.toMatchObject({
      name: 'AccountError',
      github: true,
    });
  });

  it('el mismo enlace reabierto tras otro reinicio no se canjea ni da error', async () => {
    const forgetOldProcess = await githubOpenWhenProcessDies();
    await forgetOldProcess();
    await restartProcess().completeAuthLink(callback('g-reabierto'));
    jest.clearAllMocks();

    // Android vuelve a entregar el intent con el que se abrió la app.
    const again = restartProcess();
    await expect(again.completeAuthLink(callback('g-reabierto'))).resolves.toBeDefined();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('un code de correo con un intento de GitHub viejo no toca el sello', async () => {
    const forgetOldProcess = await githubOpenWhenProcessDies();
    await forgetOldProcess();
    jest.clearAllMocks();
    withoutGithubIdentity();
    signedInAs({ email: 'ana@example.com', email_confirmed_at: '2026-09-17T10:00:00Z' });

    await restartProcess().completeAuthLink(callback('correo-en-frio'));
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('correo-en-frio');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('un intento caducado ya no cuenta', async () => {
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
    const forgetOldProcess = await githubOpenWhenProcessDies();
    await forgetOldProcess();
    clock.mockReturnValue(now + 60 * 60 * 1000);
    jest.clearAllMocks();

    await restartProcess().completeAuthLink(callback('correo-tras-una-hora'));
    expect(auth.getUserIdentities).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    clock.mockRestore();
  });

  it('un error de GitHub en frío habla de GitHub, no de pedir otro correo', async () => {
    const forgetOldProcess = await githubOpenWhenProcessDies();
    await forgetOldProcess();

    const denied = restartProcess().completeAuthLink(
      'lockin://auth/callback?error=access_denied&error_description=The+user+denied'
    );
    await expect(denied).rejects.toMatchObject({ github: true });
    await expect(denied).rejects.toThrow(/GitHub/);
    await expect(denied).rejects.not.toThrow(/correo/);
  });
});

describe('un error de GitHub en caliente', () => {
  it('se distingue del de un correo', async () => {
    const browser = pendingBrowser();
    const linking = linkGithubIdentity();
    linking.catch(() => {});
    await waitForBrowser();

    const url = 'lockin://auth/callback?error=access_denied&error_description=The+user+denied';
    const denied = completeAuthLink(url);
    denied.catch(() => {});
    browser.finish({ type: 'success', url });

    await expect(denied).rejects.toMatchObject({ github: true });
    await expect(denied).rejects.not.toThrow(/correo/);
    await linking.catch(() => {});
  });
});

/** Espera a que `linkGithubIdentity` haya abierto el navegador. */
async function waitForBrowser() {
  await until(() => jest.mocked(WebBrowser.openAuthSessionAsync).mock.calls.length > 0);
}

/** El enlace de vuelta con ese code. */
function callback(code: string) {
  return `lockin://auth/callback?code=${code}`;
}

/** Una promesa que el test resuelve cuando quiere. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Sigue si una promesa ya se ha resuelto, sin esperarla. */
function track<T>(promise: Promise<T>) {
  const tracked = { promise, settled: false };
  promise.then(
    () => (tracked.settled = true),
    () => (tracked.settled = true)
  );
  return tracked;
}

/** Deja correr las microtareas pendientes. */
async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

/** Espera, sin timers, a que se cumpla la condición. */
async function until(condition: () => boolean) {
  for (let i = 0; i < 200 && !condition(); i++) await Promise.resolve();
  expect(condition()).toBe(true);
}

/** El navegador vuelve con ese code. */
function browserReturns(code: string) {
  jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValueOnce({
    type: 'success',
    url: callback(code),
  });
}

/** El navegador sigue abierto hasta que el test diga. */
function pendingBrowser() {
  const browser = deferred<WebBrowser.WebBrowserAuthSessionResult>();
  jest.mocked(WebBrowser.openAuthSessionAsync).mockReturnValueOnce(browser.promise);
  return { finish: browser.resolve };
}

/** La cuenta no tiene (o no ha llegado a tener) identidad de GitHub. */
function withoutGithubIdentity() {
  auth.getUserIdentities.mockResolvedValue({
    data: { identities: [{ provider: 'email' }] },
    error: null,
  });
}

/**
 * Carga `auth.ts` de nuevo, como al arrancar otro proceso: sin nada en memoria,
 * pero con el mismo AsyncStorage y el mismo servidor.
 */
function restartProcess(): typeof import('./auth') {
  const storage = jest.requireMock('@react-native-async-storage/async-storage');
  const client = jest.requireMock('./client');
  const linking = jest.requireMock('expo-linking');
  const browser = jest.requireMock('expo-web-browser');
  let fresh!: typeof import('./auth');
  jest.isolateModules(() => {
    jest.doMock('@react-native-async-storage/async-storage', () => storage);
    jest.doMock('./client', () => client);
    jest.doMock('expo-linking', () => linking);
    jest.doMock('expo-web-browser', () => browser);
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- carga limpia, como `active.test.ts`
    fresh = require('./auth') as typeof import('./auth');
  });
  return fresh;
}

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
    await expect(completeAuthLink(caducado)).rejects.toMatchObject({ github: false });
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

describe('deleteMyAccount', () => {
  it('borra por RPC y cierra la sesión local sin exigir cuenta recuperable', async () => {
    auth.signOut.mockResolvedValueOnce({ error: null });

    await expect(deleteMyAccount()).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('delete_my_account');
    // Solo la sesión de este dispositivo: la cuenta ya no existe en el servidor.
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(auth.getSession).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('lockin.supabase.device-account');
  });

  it('si el servidor falla no toca la sesión local', async () => {
    rpc.mockResolvedValueOnce({ error: gotrueError('LI007', 'sin sesión') });

    await expect(deleteMyAccount()).rejects.toMatchObject({ reason: 'no-session' });

    expect(auth.signOut).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });
});
