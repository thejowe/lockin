/**
 * La contraseña elegida en el alta, a la espera de que se confirme el correo.
 *
 * Desde el 2026-10-17 el alta pide email, contraseña y su repetición en el
 * mismo paso, antes de confirmar el correo. GoTrue no deja ponérsela todavía:
 * la sesión del alta es anónima y no acepta contraseña hasta que el email está
 * verificado (ver `setAccountPassword` en `@/data/supabase/auth.ts`). Así que
 * se guarda aquí y `RegisterForm` la aplica sola en cuanto la cuenta pasa a
 * recuperable; después se borra.
 *
 * ## Tiene dueño
 *
 * Se guarda con el `auth.uid()` de la cuenta que la eligió (que no cambia en el
 * ascenso) y solo se le devuelve a esa cuenta: una contraseña olvidada de un
 * alta abandonada no puede acabar puesta en otra cuenta que entre después en
 * este teléfono. Una que no es de la sesión actual se borra al leerla.
 *
 * ## Es un secreto
 *
 * Va al Keychain/Keystore con `expo-secure-store` y **nunca** a `AsyncStorage`.
 * Si el almacén seguro falla (o en web, donde no existe) se queda solo en
 * memoria, y se borra lo que hubiera en disco: si no, tras reiniciar se leería
 * una contraseña anterior en lugar de la última. Si el sistema mata la app
 * mientras se confirma el correo se pierde, y `RegisterForm` vuelve a pedirla.
 * Peor que lo ideal, mejor que dejar una contraseña en claro en el disco.
 *
 * Caduca con el enlace del correo (24 h): pasado ese tiempo el alta empieza de
 * nuevo y no tiene sentido guardar una contraseña que nadie va a aplicar.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'cofounder.signup.pending-password';
const TTL_MS = 24 * 60 * 60 * 1000;

interface Stash {
  password: string;
  userId: string;
  at: number;
}

let memory: Stash | null = null;

const secureAvailable = Platform.OS !== 'web';

function fresh(stash: Stash | null): stash is Stash {
  return stash !== null && Date.now() - stash.at <= TTL_MS;
}

function parse(raw: string): Stash | null {
  const parsed = JSON.parse(raw) as Partial<Stash>;
  return typeof parsed.password === 'string' &&
    typeof parsed.userId === 'string' &&
    typeof parsed.at === 'number'
    ? { password: parsed.password, userId: parsed.userId, at: parsed.at }
    : null;
}

/** La contraseña guardada, sea de quien sea, si sigue vigente. */
async function readStash(): Promise<Stash | null> {
  if (fresh(memory)) return memory;
  if (!secureAvailable) return null;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const stash = parse(raw);
    if (!fresh(stash)) {
      await clearPendingPassword();
      return null;
    }
    memory = stash;
    return stash;
  } catch {
    return null;
  }
}

export async function stashPendingPassword(password: string, userId: string): Promise<void> {
  const stash: Stash = { password, userId, at: Date.now() };
  memory = stash;
  if (!secureAvailable) return;
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(stash));
  } catch {
    // Se queda en memoria; lo de disco, fuera, que sería una contraseña vieja.
    try {
      await SecureStore.deleteItemAsync(KEY);
    } catch {
      // Caduca sola a las 24 h.
    }
  }
}

/** Si hay una contraseña esperando, de quien sea: hace falta pasar por `/register`. */
export async function hasPendingPassword(): Promise<boolean> {
  return (await readStash()) !== null;
}

/**
 * La contraseña pendiente de `userId`, o `null`. Si la que hay es de otra
 * cuenta, se borra: ya no la va a aplicar nadie.
 */
export async function readPendingPassword(userId: string): Promise<string | null> {
  const stash = await readStash();
  if (!stash) return null;
  if (stash.userId !== userId) {
    await clearPendingPassword();
    return null;
  }
  return stash.password;
}

export async function clearPendingPassword(): Promise<void> {
  memory = null;
  if (!secureAvailable) return;
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Caduca sola a las 24 h.
  }
}
