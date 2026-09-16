/**
 * Sesión de Supabase.
 *
 * El contrato de `src/data/repositories.ts` no tiene login: `SessionRepository`
 * solo habla de modo activo y de perfil propio, y las pantallas de `perfil`,
 * `descubrir` y `chat` ya están construidas contra él. Como el bloque `datos`
 * no puede tocar pantallas, este módulo consigue una sesión por su cuenta antes
 * de la primera consulta.
 *
 * Estrategia, en orden:
 *
 * 1. Si ya hay sesión guardada (`AsyncStorage`), se reutiliza.
 * 2. Si no, `signInAnonymously()`. Es el camino bueno: no pide nada al usuario
 *    y la cuenta se puede convertir después en una cuenta con email sin perder
 *    perfil, matches ni mensajes. Requiere "Anonymous sign-ins" activado en
 *    Authentication → Providers del dashboard.
 * 3. Si el proyecto no permite anónimos, se crea una cuenta de dispositivo con
 *    email y contraseña aleatorios, que se guardan en `AsyncStorage`. Requiere
 *    "Confirm email" DESACTIVADO, porque nadie va a leer ese buzón.
 *
 * Cuando exista una pantalla de login de verdad, `signInWithEmail`,
 * `signUpWithEmail` y `signOut` ya están aquí para conectarla, y
 * `linkEmailToCurrentUser` convierte la cuenta anónima en una con email
 * conservando todos sus datos.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { getSupabaseClient } from './client';

/** Credenciales de la cuenta de dispositivo del paso 3. */
const DEVICE_ACCOUNT_KEY = 'lockin.supabase.device-account';

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
 * `auth.uid()` estable en este dispositivo mientras no haya login real.
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

/** Login con email y contraseña. Para cuando exista una pantalla de login. */
export async function signInWithEmail(email: string, password: string): Promise<string> {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user.id;
}

/** Alta con email y contraseña. */
export async function signUpWithEmail(email: string, password: string): Promise<string | null> {
  const { data, error } = await getSupabaseClient().auth.signUp({ email, password });
  if (error) throw error;
  return data.user?.id ?? null;
}

/**
 * Convierte la cuenta anónima actual en una con email, conservando perfil,
 * matches y mensajes: el `auth.uid()` no cambia.
 */
export async function linkEmailToCurrentUser(email: string, password: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.updateUser({ email, password });
  if (error) throw error;
}

/**
 * Cierra sesión y olvida la cuenta de dispositivo.
 *
 * Se borran también las credenciales locales: dejarlas permitiría volver a
 * entrar en la cuenta anterior desde este dispositivo después de "salir".
 */
export async function signOut(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut();
  await AsyncStorage.removeItem(DEVICE_ACCOUNT_KEY);
  if (error) throw error;
}

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
