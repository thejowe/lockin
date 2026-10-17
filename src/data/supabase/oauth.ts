/**
 * Ida y vuelta de OAuth por el navegador integrado: LinkedIn (vincular) y
 * Google/Apple (entrar o registrarse). Decisión del usuario del 2026-10-17.
 *
 * GitHub tiene su propia versión en `auth.ts`, con la vuelta en frío resuelta
 * (Android mata el proceso con el navegador delante). Esta es la misma idea en
 * general, para que no haya cuatro copias:
 *
 * - El navegador (`openAuthSessionAsync`) devuelve la URL de vuelta con el
 *   `code` de PKCE. En Android esa misma URL entra además por el router a
 *   `/auth/callback`, y un `code` solo se canjea una vez. Por eso el canje se
 *   registra aquí en cuanto el navegador vuelve, y `completeAuthLink` lo espera
 *   (`oauthCompletionFor`) en vez de canjearlo otra vez.
 * - Si el proceso murió con el navegador abierto, la vuelta llega solo por
 *   `/auth/callback`, donde `completeAuthLink` canjea el code como cualquier
 *   otro; lo que haya que hacer después (el sello de LinkedIn) lo hace él.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';

/**
 * El último code canjeado por aquí, en disco: Android puede volver a entregar
 * el intent con el que se abrió la app (al reabrirla desde recientes tras matar
 * el proceso), y ese code ya está gastado. Lo mismo hace GitHub en `auth.ts`.
 */
const CONSUMED_CODE_KEY = 'lockin.supabase.oauth-consumed-code';

/** Canjes en curso o hechos en este proceso, por `code`. */
const completions = new Map<string, Promise<void>>();
/** El navegador abierto ahora mismo, si lo hay: es quien dice qué code volvió. */
let openBrowser: Promise<unknown> | null = null;

export type OAuthOutcome = 'done' | 'cancelled';

/**
 * Abre `url` en el navegador integrado y, si vuelve con un code, ejecuta
 * `settle(code)` una sola vez aunque la misma vuelta llegue también por el
 * router.
 */
export async function runOAuth(
  url: string,
  redirectTo: string,
  settle: (code: string) => Promise<void>
): Promise<OAuthOutcome> {
  const returned = WebBrowser.openAuthSessionAsync(url, redirectTo).then((result) => {
    if (result.type !== 'success') return null;
    const params = new URL(result.url).searchParams;
    const failure = params.get('error_description') ?? params.get('error');
    if (failure) throw new Error(failure);
    const code = params.get('code');
    if (!code) throw new Error('El proveedor no devolvió el código de acceso.');
    // Registrado antes de que nadie más vea resolverse el navegador: la ruta de
    // callback que lo esperaba encuentra el canje ya en marcha.
    if (!completions.has(code)) {
      completions.set(
        code,
        settle(code).then(() =>
          AsyncStorage.setItem(CONSUMED_CODE_KEY, code).catch(() => undefined)
        )
      );
    }
    return code;
  });
  openBrowser = returned.catch(() => null);
  try {
    const code = await returned;
    if (!code) return 'cancelled';
    await completions.get(code);
    return 'done';
  } finally {
    openBrowser = null;
  }
}

/**
 * Si ese code es la vuelta de un `runOAuth` de este proceso, su canje. Con el
 * navegador todavía abierto se espera a que vuelva. `null` = no es de aquí.
 */
export async function oauthCompletionFor(
  code: string
): Promise<{ completion: Promise<void> } | null> {
  if (openBrowser && !completions.has(code)) await openBrowser;
  const completion = completions.get(code);
  if (completion) return { completion };
  // Ya canjeado en una vida anterior del proceso: no hay nada que volver a hacer.
  const consumed = await AsyncStorage.getItem(CONSUMED_CODE_KEY).catch(() => null);
  return consumed === code ? { completion: Promise.resolve() } : null;
}
