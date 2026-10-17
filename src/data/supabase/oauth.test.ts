/**
 * El canje único de las vueltas de OAuth: aunque la misma URL llegue por el
 * navegador y por el router, el code se canjea una vez.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';

import { oauthCompletionFor, runOAuth } from './oauth';

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
  WebBrowserResultType: jest.requireActual('expo-web-browser').WebBrowserResultType,
}));

const open = jest.mocked(WebBrowser.openAuthSessionAsync);

beforeEach(() => jest.clearAllMocks());

it('canjea el code una sola vez y la ruta de callback espera ese mismo canje', async () => {
  open.mockResolvedValueOnce({ type: 'success', url: 'cofounder://auth/callback?code=uno' });
  const settle = jest.fn(() => Promise.resolve());

  await expect(runOAuth('https://idp', 'cofounder://auth/callback', settle)).resolves.toBe('done');
  const fromRouter = await oauthCompletionFor('uno');

  expect(fromRouter).not.toBeNull();
  await fromRouter?.completion;
  expect(settle).toHaveBeenCalledTimes(1);
  expect(settle).toHaveBeenCalledWith('uno');
});

it('con el navegador abierto, la ruta espera a que vuelva', async () => {
  let finish: (value: WebBrowser.WebBrowserAuthSessionResult) => void = () => undefined;
  open.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
  const settle = jest.fn(() => Promise.resolve());

  const flow = runOAuth('https://idp', 'cofounder://auth/callback', settle);
  const fromRouter = oauthCompletionFor('dos');
  finish({ type: 'success', url: 'cofounder://auth/callback?code=dos' });

  await expect(fromRouter).resolves.not.toBeNull();
  await expect(flow).resolves.toBe('done');
  expect(settle).toHaveBeenCalledTimes(1);
});

it('cancelar no canjea nada', async () => {
  open.mockResolvedValueOnce({ type: WebBrowser.WebBrowserResultType.CANCEL });
  const settle = jest.fn(() => Promise.resolve());

  await expect(runOAuth('https://idp', 'cofounder://auth/callback', settle)).resolves.toBe(
    'cancelled'
  );
  expect(settle).not.toHaveBeenCalled();
});

it('un error del proveedor se cuenta, no se traga', async () => {
  open.mockResolvedValueOnce({
    type: 'success',
    url: 'cofounder://auth/callback?error=access_denied&error_description=Denegado',
  });

  await expect(runOAuth('https://idp', 'cofounder://auth/callback', jest.fn())).rejects.toThrow(
    'Denegado'
  );
});

it('un code que no es de aquí no tiene canje', async () => {
  await expect(oauthCompletionFor('ajeno')).resolves.toBeNull();
});

it('un code canjeado queda apuntado, y uno apuntado de antes no se vuelve a canjear', async () => {
  open.mockResolvedValueOnce({ type: 'success', url: 'cofounder://auth/callback?code=tres' });
  await runOAuth('https://idp', 'cofounder://auth/callback', () => Promise.resolve());
  await new Promise((resolve) => setImmediate(resolve));
  expect(await AsyncStorage.getItem('lockin.supabase.oauth-consumed-code')).toBe('tres');

  // Un proceso anterior lo canjeó: aquí no está en memoria, pero sí en disco.
  await AsyncStorage.setItem('lockin.supabase.oauth-consumed-code', 'de-otra-vida');
  await expect(oauthCompletionFor('de-otra-vida')).resolves.not.toBeNull();
});
