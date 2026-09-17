/**
 * Sesión e identidad de Supabase.
 *
 * El contrato de `src/data/repositories.ts` no tiene login: `SessionRepository`
 * solo habla de modo activo y de perfil propio, y las pantallas de `perfil`,
 * `descubrir` y `chat` ya están construidas contra él. Como el bloque `datos`
 * no puede tocar pantallas, este módulo consigue una sesión por su cuenta antes
 * de la primera consulta.
 *
 * ## Cómo se abre la sesión
 *
 * 1. Si ya hay sesión guardada (`AsyncStorage`), se reutiliza.
 * 2. Si no, `signInAnonymously()`. Es el camino bueno y el que usa la app en el
 *    proyecto real: no pide nada al usuario. Requiere "Anonymous sign-ins"
 *    activado en Authentication → Providers del dashboard.
 * 3. Si el proyecto no permite anónimos, se crea una cuenta de dispositivo con
 *    email sintético (`device-<hex>@lockin.app`) y contraseña aleatoria, que se
 *    guardan en `AsyncStorage`. Requiere "Confirm email" DESACTIVADO, porque
 *    nadie va a leer ese buzón.
 *
 * ## Ciclo de vida de la cuenta
 *
 * Entrar sin fricción es una decisión de producto de `docs/plan/CONCEPTO.md`:
 * la cuenta nace sin que el usuario haga nada y se **asciende** después. Nunca
 * se le obliga a vincular email — es opcional siempre (decisión del 2026-09-17).
 * Los estados, que `getAccountState()` devuelve tal cual, son:
 *
 *     anonymous ─┐                                 (paso 2: signInAnonymously)
 *                ├─ linkEmailToCurrentUser() ──> pending-email
 *     device ────┘                                 (paso 3: cuenta sintética)
 *                                                        │
 *                                     confirma el correo │ completeAuthLink()
 *                                                        v
 *                                                      email  ← recoverable
 *                                                        │
 *                                            setAccountPassword()
 *
 * `anonymous` y `device` son **irrecuperables**: viven solo en el
 * `AsyncStorage` de este teléfono. Desinstalar la app, limpiar datos o cambiar
 * de móvil destruye perfil, matches y conversaciones para siempre. Por eso
 * `signOut()` se niega a ejecutarse desde ahí sin `acceptDataLoss`.
 *
 * `pending-email` **todavía no es recuperable**: hasta que el usuario pincha el
 * enlace del correo, Supabase no da el email por bueno y `signInWithEmail` no
 * funcionaría. Prometer lo contrario sería mentir, así que `recoverable` sigue
 * en `false` (decisión del 2026-09-17: "solo tras confirmar el correo").
 *
 * En todo el ascenso el `auth.uid()` **no cambia**: es exactamente lo que salva
 * el perfil, los matches y los mensajes, que cuelgan de él por RLS.
 *
 * ## Lo que hace falta en el dashboard
 *
 * - "Confirm email" ACTIVADO para que exista el estado `pending-email`. Ojo:
 *   eso inutiliza el paso 3 (la cuenta de dispositivo necesita lo contrario),
 *   que pasa a ser una red de seguridad rota. Mientras "Anonymous sign-ins"
 *   siga activo, el paso 3 no se ejecuta nunca.
 * - "Secure email change" DESACTIVADO: con él, cambiar el email de una cuenta
 *   de dispositivo mandaría también una confirmación a `device-…@lockin.app`,
 *   un buzón que no existe, y el ascenso no se completaría jamás.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { getSupabaseClient } from './client';

import type { EmailOtpType, User } from '@supabase/supabase-js';

/** Credenciales de la cuenta de dispositivo del paso 3. */
const DEVICE_ACCOUNT_KEY = 'lockin.supabase.device-account';

/**
 * Los emails que fabrica el paso 3. Se reconocen por su forma porque son la
 * diferencia entre "tienes email, estás a salvo" y "tienes un email que no
 * recibe correo y no te salva de nada".
 */
const DEVICE_EMAIL_PATTERN = /^device-[0-9a-f]+@lockin\.app$/i;

/** El destino de los enlaces que Supabase manda por correo. */
function authRedirectUrl(): string {
  return Linking.createURL('/auth/callback');
}

/* -------------------------------------------------------------------------- */
/* Errores con nombre                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Por qué falló una operación de cuenta.
 *
 * La pantalla de `perfil` (orden P1) necesita distinguirlas para escribir un
 * mensaje distinto en cada caso; hacerlo con expresiones regulares sobre el
 * texto del servidor es frágil, así que se traduce aquí una sola vez.
 */
export type AccountErrorReason =
  | 'email-in-use'
  | 'weak-password'
  | 'invalid-email'
  | 'same-password'
  | 'too-many-emails'
  | 'needs-confirmed-email'
  | 'unrecoverable-account'
  | 'no-session'
  | 'offline'
  | 'unknown';

/** Fallo de una operación de cuenta, ya traducido a algo que se puede enseñar. */
export class AccountError extends Error {
  readonly reason: AccountErrorReason;

  constructor(reason: AccountErrorReason, message: string, cause?: unknown) {
    super(message);
    this.name = 'AccountError';
    this.reason = reason;
    if (cause !== undefined) this.cause = cause;
  }
}

function errorField(error: unknown, field: 'code' | 'name'): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const value = (error as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Traduce un error de GoTrue a un `AccountError`.
 *
 * Los códigos son los de
 * https://supabase.com/docs/guides/auth/debugging/error-codes — se comparan por
 * `code` y no por el texto, que viene en inglés y cambia entre versiones.
 */
function toAccountError(error: unknown): AccountError {
  if (error instanceof AccountError) return error;

  switch (errorField(error, 'code')) {
    case 'email_exists':
    case 'user_already_exists':
      // Decisión de producto del 2026-09-17: aquí no se ofrece ninguna salida.
      // Entrar en la otra cuenta implicaría abandonar el perfil, los matches y
      // los chats de este dispositivo, y eso no se propone de pasada.
      return new AccountError(
        'email-in-use',
        'Ese email ya tiene una cuenta de LockIn. Prueba con otro.',
        error
      );
    case 'weak_password':
      return new AccountError(
        'weak-password',
        'Esa contraseña es demasiado fácil de adivinar. Alárgala o mézclala con números.',
        error
      );
    case 'email_address_invalid':
    case 'validation_failed':
      return new AccountError('invalid-email', 'Ese email no parece válido. Revísalo.', error);
    case 'same_password':
      return new AccountError(
        'same-password',
        'La contraseña nueva tiene que ser distinta de la que ya tenías.',
        error
      );
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return new AccountError(
        'too-many-emails',
        'Se han mandado demasiados correos a esa dirección. Espera unos minutos y vuelve a intentarlo.',
        error
      );
    case 'email_not_confirmed':
      return new AccountError(
        'needs-confirmed-email',
        'Falta confirmar el email: pincha el enlace que te hemos mandado y vuelve aquí.',
        error
      );
    default:
      break;
  }

  // Sin código y sin respuesta HTTP: la petición no llegó a salir.
  if (errorField(error, 'name') === 'AuthRetryableFetchError') {
    return new AccountError(
      'offline',
      'No hay conexión con el servidor. Inténtalo otra vez cuando vuelvas a tener red.',
      error
    );
  }

  const message = error instanceof Error ? error.message : 'Error desconocido en la cuenta.';
  return new AccountError('unknown', message, error);
}

/* -------------------------------------------------------------------------- */
/* Apertura de sesión                                                         */
/* -------------------------------------------------------------------------- */

interface DeviceAccount {
  email: string;
  password: string;
}

/**
 * Bytes aleatorios criptográficos. Se exige `crypto.getRandomValues`: generar
 * la contraseña de una cuenta con `Math.random()` sería una contraseña
 * adivinable, y preferimos fallar con un mensaje claro.
 */
function randomHex(bytes: number): string {
  const source = globalThis.crypto;
  if (!source?.getRandomValues) {
    throw new Error(
      'No hay crypto.getRandomValues en este runtime, así que no se puede crear una ' +
        'cuenta de dispositivo segura. Activa "Anonymous sign-ins" en el dashboard de ' +
        'Supabase (Authentication → Providers) para no necesitarla.'
    );
  }

  const buffer = new Uint8Array(bytes);
  source.getRandomValues(buffer);
  return [...buffer].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readDeviceAccount(): Promise<DeviceAccount | null> {
  const stored = await AsyncStorage.getItem(DEVICE_ACCOUNT_KEY);
  if (!stored) return null;

  try {
    const parsed: unknown = JSON.parse(stored);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as DeviceAccount).email === 'string' &&
      typeof (parsed as DeviceAccount).password === 'string'
    ) {
      return parsed as DeviceAccount;
    }
  } catch {
    // Entrada corrupta: se descarta y se crea una cuenta nueva.
  }

  return null;
}

/**
 * Entra con la cuenta de dispositivo, creándola la primera vez.
 *
 * El email es sintético y no recibe correo. Sirve solo para tener un
 * `auth.uid()` estable en este dispositivo mientras el usuario no ascienda la
 * cuenta con `linkEmailToCurrentUser`.
 */
async function signInWithDeviceAccount(): Promise<string> {
  const client = getSupabaseClient();
  const existing = await readDeviceAccount();

  if (existing) {
    const { data, error } = await client.auth.signInWithPassword(existing);
    if (!error && data.user) return data.user.id;
    // Si las credenciales guardadas ya no valen (proyecto reseteado, usuario
    // borrado) se cae hacia abajo y se crea una cuenta nueva.
  }

  const account: DeviceAccount = {
    email: `device-${randomHex(12)}@lockin.app`,
    password: randomHex(24),
  };

  const { data, error } = await client.auth.signUp(account);
  if (error) throw error;
  if (!data.user) {
    throw new Error(
      'Supabase creó la cuenta pero no devolvió sesión: probablemente "Confirm email" ' +
        'está activado. Desactívalo, o activa "Anonymous sign-ins", para que la app ' +
        'pueda arrancar sin pantalla de login.'
    );
  }

  await AsyncStorage.setItem(DEVICE_ACCOUNT_KEY, JSON.stringify(account));

  // Con "Confirm email" desactivado, `signUp` ya deja sesión abierta. Si no la
  // hubiera dejado, este login la abre.
  if (!data.session) {
    const { data: signedIn, error: signInError } = await client.auth.signInWithPassword(account);
    if (signInError) throw signInError;
    return signedIn.user.id;
  }

  return data.user.id;
}

/** Evita que dos consultas simultáneas creen dos sesiones al arrancar. */
let pending: Promise<string> | null = null;

async function createSession(): Promise<string> {
  const client = getSupabaseClient();

  const { data: anonymous, error: anonymousError } = await client.auth.signInAnonymously();
  if (!anonymousError && anonymous.user) return anonymous.user.id;

  return signInWithDeviceAccount();
}

/**
 * Devuelve el `auth.uid()` de la sesión, abriéndola si hace falta.
 *
 * Todos los repositorios de `index.ts` empiezan llamando aquí: sin sesión, RLS
 * niega absolutamente todo y las consultas volverían vacías sin explicar por qué.
 */
export async function ensureUserId(): Promise<string> {
  const client = getSupabaseClient();

  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (data.session?.user) return data.session.user.id;

  pending ??= createSession().finally(() => {
    pending = null;
  });

  return pending;
}

/** El `auth.uid()` actual sin abrir sesión. `null` si no hay ninguna. */
export async function currentUserId(): Promise<string | null> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  return data.session?.user.id ?? null;
}

/* -------------------------------------------------------------------------- */
/* Estado de la cuenta                                                        */
/* -------------------------------------------------------------------------- */

/** En qué punto del ciclo de vida está la cuenta. Ver el encabezado. */
export type AccountKind = 'none' | 'anonymous' | 'device' | 'pending-email' | 'email';

export interface AccountState {
  kind: AccountKind;
  /** El `auth.uid()`, que no cambia en todo el ascenso. */
  userId: string | null;
  /** Email confirmado y real. Nunca el sintético del paso 3. */
  email: string | null;
  /** Email a la espera de que el usuario pinche el enlace del correo. */
  pendingEmail: string | null;
  /**
   * `true` solo si la cuenta se puede recuperar desde otro dispositivo.
   *
   * Es la única pregunta que le importa a la pantalla: si es `false`, los datos
   * viven solo aquí. Vincular GitHub (`linkGithubIdentity`) **no** cuenta: en
   * LockIn es el distintivo de verificación y la app no ofrece "entrar con
   * GitHub", así que no es un camino de vuelta.
   */
  recoverable: boolean;
}

const NO_SESSION: AccountState = {
  kind: 'none',
  userId: null,
  email: null,
  pendingEmail: null,
  recoverable: false,
};

function describeUser(user: User): AccountState {
  const newEmail = user.new_email ?? null;
  const email = user.email ?? null;
  const synthetic = email !== null && DEVICE_EMAIL_PATTERN.test(email);
  const confirmed = Boolean(user.email_confirmed_at);
  const recoverable = email !== null && !synthetic && confirmed;

  let kind: AccountKind;
  if (recoverable) kind = 'email';
  else if (newEmail !== null) kind = 'pending-email';
  else if (user.is_anonymous === true) kind = 'anonymous';
  else if (synthetic) kind = 'device';
  else if (email !== null) kind = 'pending-email';
  else kind = 'anonymous';

  return {
    kind,
    userId: user.id,
    email: recoverable ? email : null,
    // Un email presente pero sin confirmar es, para el usuario, lo mismo que
    // uno pendiente: todavía no le devuelve la cuenta. El sintético del paso 3
    // no cuenta como pendiente de nada, porque nadie va a confirmarlo.
    pendingEmail: newEmail ?? (recoverable || synthetic ? null : email),
    recoverable,
  };
}

/**
 * En qué estado está la cuenta de quien usa la app ahora mismo.
 *
 * Pregunta al servidor (`getUser()`) y no a la sesión guardada, porque la
 * confirmación del email ocurre fuera de la app —en el cliente de correo— y el
 * JWT que hay en `AsyncStorage` sigue diciendo lo de antes hasta que se renueva.
 * Si el servidor no contesta se cae a la sesión local: quedarse sin red no
 * puede dejar la pantalla de perfil en blanco, solo desactualizada.
 */
export async function getAccountState(): Promise<AccountState> {
  const client = getSupabaseClient();

  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw toAccountError(sessionError);

  const sessionUser = sessionData.session?.user;
  if (!sessionUser) return NO_SESSION;

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return describeUser(sessionUser);

  return describeUser(data.user);
}

/* -------------------------------------------------------------------------- */
/* Ascenso y recuperación                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Empieza el ascenso de la cuenta actual a una con email, conservando perfil,
 * matches y mensajes: el `auth.uid()` no cambia.
 *
 * No termina aquí. Supabase manda un correo al email indicado y la cuenta sigue
 * siendo irrecuperable hasta que el usuario pincha ese enlace, que vuelve a la
 * app por `lockin://auth/callback` y cierra `completeAuthLink`.
 *
 * Tampoco se pone contraseña en este paso: GoTrue exige que el email esté
 * verificado antes de aceptar una contraseña para una cuenta anónima
 * (https://supabase.com/docs/guides/auth/auth-anonymous). Eso es
 * `setAccountPassword`, después.
 *
 * @returns El estado de la cuenta tras pedir la confirmación.
 */
export async function linkEmailToCurrentUser(email: string): Promise<AccountState> {
  const { data, error } = await getSupabaseClient().auth.updateUser(
    { email },
    { emailRedirectTo: authRedirectUrl() }
  );
  if (error) throw toAccountError(error);

  return data.user ? describeUser(data.user) : getAccountState();
}

/**
 * Pone contraseña a la cuenta. Es el último paso del ascenso y también el que
 * cierra una recuperación de contraseña.
 *
 * Exige el email ya confirmado: sin eso GoTrue rechaza la contraseña y la
 * cuenta se quedaría a medias, con un email que no abre nada.
 */
export async function setAccountPassword(password: string): Promise<void> {
  const state = await getAccountState();
  if (state.kind === 'none') {
    throw new AccountError('no-session', 'No hay ninguna sesión abierta.');
  }
  if (!state.recoverable) {
    throw new AccountError(
      'needs-confirmed-email',
      'Falta confirmar el email: pincha el enlace que te hemos mandado y vuelve aquí.'
    );
  }

  const { error } = await getSupabaseClient().auth.updateUser({ password });
  if (error) throw toAccountError(error);
}

/**
 * Manda el correo de recuperación de contraseña.
 *
 * El enlace vuelve a la app por el esquema `lockin://`, abre sesión en la
 * cuenta de ese email y deja al usuario en condiciones de llamar a
 * `setAccountPassword`.
 *
 * No dice si el email existe o no: responder distinto sería contarle a
 * cualquiera que pregunte quién tiene cuenta en LockIn.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
    redirectTo: authRedirectUrl(),
  });
  if (error) throw toAccountError(error);
}

/**
 * Cierra el enlace que llega por `lockin://auth/callback`: confirmación de
 * email o recuperación de contraseña.
 *
 * Acepta las dos formas en que Supabase puede devolverlo según la plantilla de
 * correo del proyecto: `?code=` (PKCE, que es el flujo de este cliente) y
 * `?token_hash=&type=`. Si el enlace trae un error lo traduce, en vez de fallar
 * en silencio dejando al usuario esperando una confirmación que nunca llega.
 *
 * Cuando el enlace deja la cuenta ya recuperable se olvidan las credenciales de
 * dispositivo: seguir guardándolas dejaría una segunda puerta a la misma cuenta
 * escrita en claro en este teléfono, y ya no hace falta para nada.
 *
 * @returns El estado de la cuenta después de aplicar el enlace.
 */
export async function completeAuthLink(url: string): Promise<AccountState> {
  const client = getSupabaseClient();
  const params = new URL(url).searchParams;

  const failure = params.get('error_description') ?? params.get('error');
  if (failure) {
    throw new AccountError(
      'unknown',
      `El enlace ya no sirve (${failure}). Pide otro correo e inténtalo de nuevo.`
    );
  }

  const code = params.get('code');
  const tokenHash = params.get('token_hash');
  const type = params.get('type');

  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw toAccountError(error);
  } else if (tokenHash && type) {
    const { error } = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (error) throw toAccountError(error);
  } else {
    throw new AccountError(
      'unknown',
      'Ese enlace no trae el código de confirmación. Pide otro correo.'
    );
  }

  const state = await getAccountState();
  if (state.recoverable) await AsyncStorage.removeItem(DEVICE_ACCOUNT_KEY);
  return state;
}

/** Login con email y contraseña, para recuperar la cuenta en otro dispositivo. */
export async function signInWithEmail(email: string, password: string): Promise<string> {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) throw toAccountError(error);
  return data.user.id;
}

/** Alta con email y contraseña. */
export async function signUpWithEmail(email: string, password: string): Promise<string | null> {
  const { data, error } = await getSupabaseClient().auth.signUp({ email, password });
  if (error) throw toAccountError(error);
  return data.user?.id ?? null;
}

/**
 * Cierra sesión y olvida la cuenta de dispositivo.
 *
 * Se borran también las credenciales locales: dejarlas permitiría volver a
 * entrar en la cuenta anterior desde este dispositivo después de "salir".
 *
 * Justo por eso, desde una cuenta sin email confirmado esto **no es cerrar
 * sesión, es destruir los datos**: no queda ninguna forma de volver a ese
 * `auth.uid()`, y con él se van perfil, matches y conversaciones. Ahí se niega,
 * y solo `acceptDataLoss: true` lo desbloquea — el flag existe para que la
 * pantalla tenga que haber avisado antes de pasarlo.
 */
export async function signOut(options: { acceptDataLoss?: boolean } = {}): Promise<void> {
  if (!options.acceptDataLoss) {
    const state = await getAccountState();
    if (state.kind !== 'none' && !state.recoverable) {
      throw new AccountError(
        'unrecoverable-account',
        'Esta cuenta solo vive en este teléfono: cerrar sesión borraría tu perfil, tus ' +
          'matches y tus conversaciones sin vuelta atrás. Añade un email antes, o pasa ' +
          'acceptDataLoss cuando el usuario ya haya dicho que sí a perderlo todo.'
      );
    }
  }

  const { error } = await getSupabaseClient().auth.signOut();
  await AsyncStorage.removeItem(DEVICE_ACCOUNT_KEY);
  if (error) throw toAccountError(error);
}

/* -------------------------------------------------------------------------- */
/* Identidad de GitHub (distintivo de verificación)                           */
/* -------------------------------------------------------------------------- */

/**
 * PKCE devuelve un code: con detectSessionInUrl: false el SDK no lo canjea
 * automáticamente (confirmado en la Tarea 1, commit 360d693).
 */
async function completeOAuthCallback(url: string): Promise<void> {
  const code = new URL(url).searchParams.get('code');
  if (!code) throw new Error('GitHub no devolvió el código de verificación.');

  const { error } = await getSupabaseClient().auth.exchangeCodeForSession(code);
  if (error) throw error;
}

/**
 * Abre GitHub en el navegador del sistema y linka esa identidad a la cuenta
 * actual, conservando perfil, matches y mensajes: el `auth.uid()` no cambia.
 *
 * Requiere "Enable Manual Linking" en Authentication → Settings del dashboard.
 * Está DESACTIVADO por defecto y sin él esto falla siempre, así que el error lo
 * dice por su nombre en vez de propagar el mensaje crudo del servidor.
 *
 * @returns `true` si el usuario completó el flujo; `false` si lo canceló.
 */
export async function linkGithubIdentity(): Promise<boolean> {
  const client = getSupabaseClient();
  const redirectTo = Linking.createURL('/auth/callback');

  const { data, error } = await client.auth.linkIdentity({
    provider: 'github',
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error) {
    if (/manual linking/i.test(error.message)) {
      throw new Error(
        'Falta activar "Enable Manual Linking" en Authentication → Settings del ' +
          'dashboard de Supabase: sin él no se puede verificar GitHub.'
      );
    }
    if (/already/i.test(error.message)) {
      throw new Error('Esa cuenta de GitHub ya está verificada en otro perfil de LockIn.');
    }
    throw error;
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;

  await completeOAuthCallback(result.url);
  return true;
}

/** Desvincula la identidad de GitHub de la cuenta actual. */
export async function unlinkGithubIdentity(): Promise<void> {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getUserIdentities();
  if (error) throw error;

  const github = data.identities.find((identity) => identity.provider === 'github');
  if (!github) return;

  const { error: unlinkError } = await client.auth.unlinkIdentity(github);
  if (unlinkError) throw unlinkError;
}
