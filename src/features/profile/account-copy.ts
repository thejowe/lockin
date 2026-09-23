/**
 * El texto que lee la persona cuando una operación de cuenta falla.
 *
 * `src/data/supabase/auth.ts` traduce el fallo del servidor a un
 * `AccountError.reason` justamente para que ninguna pantalla tenga que mirar el
 * texto inglés de GoTrue, que además cambia entre versiones. Pero tener el
 * `reason` no basta: hasta ahora las pantallas enseñaban `error.message` y eso
 * dejaba tres huecos por los que se colaba texto que no es para el usuario.
 *
 * ## Qué hace este módulo y qué no
 *
 * `COPY` responde a cada razón. `null` significa «el mensaje que trae el
 * `AccountError` ya es copy de usuario en español»: esas seis razones se
 * escribieron pensando en la pantalla y duplicarlas aquí solo crearía dos
 * textos que se desincronizan. Las demás llevan copy propio, porque el mensaje
 * de la capa de datos no sirve para enseñarlo:
 *
 * - `unrecoverable-account` habla de `acceptDataLoss`, que es una instrucción
 *   para quien programa la pantalla, no para quien la usa.
 * - `no-session` es correcto pero no dice qué hacer.
 * - `offline` sí venía en español, pero es el único que tiene que valer también
 *   para un fallo de red que NUNCA llegó a ser un `AccountError` (ver abajo),
 *   así que el texto vive aquí y no en dos sitios.
 * - `unknown` es el agujero grande: es la razón por defecto de `toAccountError`,
 *   y ahí el mensaje es el del servidor, en inglés («Invalid login
 *   credentials», «Email link is invalid or has expired»…).
 *
 * `Record<AccountErrorReason, …>` y no `Partial`: si `auth.ts` añade una razón
 * nueva, esto deja de compilar hasta que alguien decida qué se enseña. El mapa
 * a medias que había antes es justo lo que no puede volver a pasar.
 *
 * ## El caso más probable en un móvil de verdad es quedarse sin red
 *
 * Y no siempre llega como `AccountError`: `signInWithPassword` sin red da un
 * `AuthRetryableFetchError` que `auth.ts` sí traduce, pero una consulta a
 * PostgREST (la que `sign-in-form` hace para saber si entrar abandona un
 * perfil) rechaza con el `TypeError` crudo del runtime, que nunca pasa por
 * `toAccountError`. Sin `looksOffline` la pantalla enseñaba «Network request
 * failed» donde el usuario espera enterarse de que no hay cobertura — y en la
 * pantalla de entrar, eso se confunde con «me he equivocado de contraseña».
 */

import { AccountError } from './account-gateway';

import type { AccountErrorReason } from './account-gateway';

/** Sin red. Vale para el `AccountError` y para el fallo crudo del runtime. */
const OFFLINE = 'No hay conexión con el servidor. Comprueba tu red y vuelve a intentarlo.';

/** Cuando no se sabe más: nunca el texto del servidor, que viene en inglés. */
const GENERIC = 'No hemos podido completar la operación. Inténtalo otra vez.';

/**
 * Qué se enseña por cada razón; `null` = el mensaje del `AccountError` ya es
 * copy de usuario y se usa tal cual.
 */
const COPY: Record<AccountErrorReason, string | null> = {
  'email-in-use': null,
  'weak-password': null,
  'invalid-email': null,
  'same-password': null,
  'too-many-emails': null,
  'needs-confirmed-email': null,
  'unrecoverable-account':
    'Esta cuenta solo vive en este teléfono: si cierras sesión, tu perfil, tus matches y tus ' +
    'conversaciones desaparecen para siempre. Asegúrala antes con un email.',
  'no-session': 'Aquí ya no hay ninguna sesión abierta. Cierra LockIn, vuelve a abrirla y repite.',
  offline: OFFLINE,
  unknown: null,
};

/** El `code` de GoTrue que viene dentro del `cause` del `AccountError`. */
function causeCode(cause: unknown): string | undefined {
  if (typeof cause !== 'object' || cause === null) return undefined;
  const code = (cause as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Si el fallo es «no hay red», venga de donde venga.
 *
 * Se mira el `name` antes que el texto: `AuthRetryableFetchError` es el nombre
 * estable que pone supabase-js. El texto es el último recurso, para los fallos
 * que ni siquiera son suyos (el `fetch` del runtime, que en React Native dice
 * «Network request failed» y en web «Failed to fetch»).
 */
function looksOffline(cause: unknown): boolean {
  if (typeof cause !== 'object' || cause === null) return false;

  const { name, message } = cause as { name?: unknown; message?: unknown };
  if (name === 'AuthRetryableFetchError') return true;

  return (
    typeof message === 'string' &&
    /network request failed|failed to fetch|network error/i.test(message)
  );
}

/**
 * El mensaje que se le enseña a la persona por un fallo de cuenta.
 *
 * Lo usan las tres pantallas que operan sobre la cuenta (`register-form`,
 * `sign-in-form`, `account-section`, estas dos últimas a través de
 * `use-account-actions`) y el retorno del enlace del correo (`auth-callback`),
 * para que un mismo fallo se cuente igual se llegue por donde se llegue.
 */
export function describeAccountError(cause: unknown): string {
  if (cause instanceof AccountError) {
    if (cause.reason === 'unknown') {
      // `invalid_credentials` es el fallo propio de «Ya tengo cuenta» y GoTrue
      // no le da código traducible en `auth.ts`, así que se reconoce aquí. No
      // distingue «ese email no existe» de «contraseña errónea»: decirlo sería
      // contarle a cualquiera quién tiene cuenta en LockIn.
      if (causeCode(cause.cause) === 'invalid_credentials') {
        return 'Email o contraseña incorrectos. Revísalos e inténtalo otra vez.';
      }
      if (looksOffline(cause.cause)) return OFFLINE;
      // Con `cause` el mensaje es el del servidor (inglés); sin él lo escribió
      // `auth.ts` para la pantalla (los dos casos de `completeAuthLink`).
      return cause.cause === undefined ? cause.message : GENERIC;
    }

    return COPY[cause.reason] ?? cause.message;
  }

  // Lo que nunca pasó por `toAccountError`: una consulta a PostgREST, el
  // cliente sin credenciales, un rechazo que ni siquiera es un `Error`.
  if (looksOffline(cause)) return OFFLINE;
  return GENERIC;
}
