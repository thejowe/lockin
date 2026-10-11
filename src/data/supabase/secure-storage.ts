/**
 * Almacenamiento de la sesión de Supabase y de las credenciales de la cuenta de
 * dispositivo.
 *
 * El refresh token y la contraseña de dispositivo son secretos: `AsyncStorage`
 * los guarda en claro, legibles en una copia de seguridad o en un teléfono con
 * root. Aquí van al Keystore de Android / Keychain de iOS con `expo-secure-store`.
 *
 * Reglas que no hay que deshacer (todas salen de perder o resucitar sesiones):
 *
 * - **Migración al leer.** Quien ya tiene sesión en `AsyncStorage` la conserva:
 *   el primer `getItem` la copia al almacén seguro y borra la copia en claro.
 *   Perder la sesión de una cuenta anónima es perder el perfil para siempre.
 * - **Un error de lectura no es «no hay sesión».** Si el Keystore lanza y no hay
 *   copia en `AsyncStorage`, el error se propaga: devolver `null` haría que la app
 *   creara otra cuenta y pisara el único refresh token de la original.
 * - **Escritura por generaciones.** El valor se parte en trozos
 *   (`<key>.<gen>.<i>`) y un manifiesto (`<key>.m`) apunta a la generación viva.
 *   El manifiesto se escribe el último y los trozos viejos se borran después, así
 *   que una app que muere a mitad de escritura deja intacto el valor anterior.
 *   Los trozos existen porque una sesión con el usuario dentro pasa de los 2048
 *   bytes que algunas versiones de iOS han rechazado.
 * - **Si no se puede escribir en el Keystore, se escribe en `AsyncStorage`** (peor
 *   que lo ideal, mejor que cerrar la sesión), y se invalida el manifiesto para
 *   que ese valor sea el que se lea y no uno antiguo del almacén seguro.
 * - **Una operación a la vez por clave.** `auth-js` permite lecturas que se solapan
  con un refresco; sin cola, una lectura podría ver el manifiesto viejo justo
  antes de que se borren sus trozos y creer que no hay sesión.
- **Borrar no miente.** `removeItem` propaga los fallos del almacén seguro: dar
 *   por cerrada una sesión que sigue ahí la resucitaría en el siguiente arranque.
 *
 * En web no hay Keychain: se queda `AsyncStorage` (localStorage).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Caracteres por trozo. Muy por debajo de los 2048 bytes históricos de iOS. */
const CHUNK_SIZE = 1800;

interface Manifest {
  /** Generación viva: es parte del nombre de sus trozos. */
  g: string;
  /** Número de trozos de esa generación. */
  n: number;
}

const manifestKey = (key: string): string => `${key}.m`;
const chunkKey = (key: string, gen: string, index: number): string => `${key}.${gen}.${index}`;

function parseManifest(raw: string | null): Manifest | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as Manifest).g === 'string' &&
      /^[0-9a-z]+$/.test((parsed as Manifest).g) &&
      Number.isInteger((parsed as Manifest).n) &&
      (parsed as Manifest).n >= 1
    ) {
      return parsed as Manifest;
    }
  } catch {
    // Manifiesto corrupto: se trata como ausente.
  }
  return null;
}

async function readSecure(key: string): Promise<string | null> {
  const manifest = parseManifest(await SecureStore.getItemAsync(manifestKey(key)));
  if (manifest === null) return null;

  const parts: string[] = [];
  for (let i = 0; i < manifest.n; i += 1) {
    const part = await SecureStore.getItemAsync(chunkKey(key, manifest.g, i));
    // Un trozo que falta es un almacén dañado: el valor no es fiable.
    if (part === null) return null;
    parts.push(part);
  }
  return parts.join('');
}

async function deleteChunks(key: string, manifest: Manifest | null): Promise<void> {
  if (manifest === null) return;
  for (let i = 0; i < manifest.n; i += 1) {
    await SecureStore.deleteItemAsync(chunkKey(key, manifest.g, i));
  }
}

async function writeSecure(key: string, value: string): Promise<void> {
  const previous = parseManifest(await SecureStore.getItemAsync(manifestKey(key)));

  let gen = Date.now().toString(36);
  if (previous !== null && previous.g === gen) gen = `${gen}x`;

  const chunks: string[] = [];
  for (let i = 0; i < value.length || chunks.length === 0; i += CHUNK_SIZE) {
    chunks.push(value.slice(i, i + CHUNK_SIZE));
  }

  try {
    for (let i = 0; i < chunks.length; i += 1) {
      await SecureStore.setItemAsync(chunkKey(key, gen, i), chunks[i] as string);
    }
    // Un único `set` cambia la generación viva: antes de él se lee el valor
    // anterior completo, después el nuevo completo.
    const manifest: Manifest = { g: gen, n: chunks.length };
    await SecureStore.setItemAsync(manifestKey(key), JSON.stringify(manifest));
  } catch (error) {
    // La generación a medias no la referencia nadie: se intenta limpiarla.
    await deleteChunks(key, { g: gen, n: chunks.length }).catch(() => undefined);
    throw error;
  }

  // El valor nuevo ya está vivo; los trozos viejos son basura, no un fallo.
  await deleteChunks(key, previous).catch(() => undefined);
}

const queues = new Map<string, Promise<unknown>>();

/** Encadena las operaciones de una misma clave: una termina antes de que empiece la siguiente. */
function serial<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const run = (queues.get(key) ?? Promise.resolve()).then(operation, operation);
  const tail = run.catch(() => undefined);
  queues.set(key, tail);
  void tail.then(() => {
    if (queues.get(key) === tail) queues.delete(key);
  });
  return run;
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(key);

  let secure: string | null;
  try {
    secure = await readSecure(key);
  } catch (error) {
    // Sin copia en AsyncStorage, «no hay sesión» sería mentira: se propaga.
    const fallback = await AsyncStorage.getItem(key);
    if (fallback === null) throw error;
    return fallback;
  }
  if (secure !== null) return secure;

  const legacy = await AsyncStorage.getItem(key);
  if (legacy === null) return null;

  try {
    await writeSecure(key, legacy);
    await AsyncStorage.removeItem(key);
  } catch {
    // Se queda donde estaba; se reintenta en la próxima lectura.
  }
  return legacy;
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') return AsyncStorage.setItem(key, value);

  try {
    await writeSecure(key, value);
  } catch {
    await AsyncStorage.setItem(key, value);
    // Que el valor del Keystore (viejo) no gane a la lectura. Si ni esto se
    // puede, se propaga: dar por guardado un valor que la lectura va a ignorar
    // sería perder el token nuevo sin avisar.
    await SecureStore.deleteItemAsync(manifestKey(key));
    return;
  }
  await AsyncStorage.removeItem(key);
}

async function removeItem(key: string): Promise<void> {
  // Primero la copia en claro: si el Keystore falla y se propaga, al menos no
  // queda ahí una sesión que el Keystore ya no cubre.
  await AsyncStorage.removeItem(key);
  if (Platform.OS === 'web') return;

  const manifest = parseManifest(await SecureStore.getItemAsync(manifestKey(key)));
  await SecureStore.deleteItemAsync(manifestKey(key));
  await deleteChunks(key, manifest).catch(() => undefined);
}

/** Interfaz `storage` de `@supabase/supabase-js`, y de las credenciales de dispositivo. */
export const secureAuthStorage = {
  getItem: (key: string) => serial(key, () => getItem(key)),
  setItem: (key: string, value: string) => serial(key, () => setItem(key, value)),
  removeItem: (key: string) => serial(key, () => removeItem(key)),
};
