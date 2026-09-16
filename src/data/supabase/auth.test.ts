import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { currentUserId, ensureUserId, linkGithubIdentity, unlinkGithubIdentity } from './auth';
import { getSupabaseClient } from './client';

jest.mock('./client', () => ({ getSupabaseClient: jest.fn() }));
jest.mock('expo-linking', () => ({ createURL: jest.fn() }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
const auth = {
  getSession: jest.fn(),
  signInAnonymously: jest.fn(),
  linkIdentity: jest.fn(),
  exchangeCodeForSession: jest.fn(),
  getUserIdentities: jest.fn(),
  unlinkIdentity: jest.fn(),
};
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
    expect(Linking.createURL).toHaveBeenCalledWith('/auth/callback');
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
