/**
 * URLs firmadas de las fotos de perfil.
 *
 * El bucket `avatars` es privado y `profiles.avatar_url` guarda la RUTA del
 * objeto (`<uid>/<uuid>.jpg`), no una URL. Al leer perfiles, el repositorio
 * cambia esa ruta por una URL firmada y temporal en `avatar.imageUrl`, así que
 * las pantallas siguen viendo solo una URL que pintar.
 *
 * - Firma por lote (`createSignedUrls`): un viaje por tanda de perfiles.
 * - Caché en memoria por ruta: la misma ruta devuelve la MISMA URL mientras
 *   dure, lo que mantiene la caché de imagen del deck. Se renueva cuando le
 *   queda poco (`REFRESH_MARGIN_MS`), no cuando ya ha caducado.
 * - Un fallo al firmar nunca rompe la lectura del perfil: sin `imageUrl` se
 *   pintan las iniciales, pero `hasPhoto` sigue diciendo que la foto existe.
 * - Las pantallas conservan los perfiles ya leídos (el deck, sobre todo), así que
 *   el signer avisa (`onStale`) cuando alguna URL llega al margen de caducidad,
 *   con un temporizador y al volver la app a primer plano; `DataProvider` relee
 *   entonces las consultas montadas.
 */

import { AppState } from 'react-native';

import { emitMediaStale } from '../media-refresh';

import type { LockInSupabaseClient } from './client';
import type { Profile } from '../types';

const BUCKET = 'avatars';

/** Vida de cada URL firmada. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;
/** Se firma de nuevo si a la URL le queda menos de esto. */
export const REFRESH_MARGIN_MS = 10 * 60 * 1000;

export interface AvatarSigner {
  /** Sustituye la ruta de `avatar.imageUrl` por una URL firmada (o la quita si no se puede). */
  signProfiles<T extends Profile>(profiles: T[]): Promise<T[]>;
  /** Olvida las URLs en caché (p. ej. al cerrar sesión). */
  clear(): void;
}

export interface AvatarSignerOptions {
  now?: () => number;
  /** Se llama cuando alguna URL en uso está a punto de caducar. */
  onStale?: () => void;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  /** Registra un aviso de «la app vuelve a primer plano». Devuelve la baja. */
  onForeground?: (callback: () => void) => () => void;
}

/** Entre dos avisos seguidos nunca pasa menos de esto: da tiempo a que la relectura firme. */
const MIN_REARM_MS = 60 * 1000;

function defaultTimer(callback: () => void, ms: number): unknown {
  const handle = setTimeout(callback, ms) as unknown as { unref?: () => void };
  handle.unref?.();
  return handle;
}

function defaultOnForeground(callback: () => void): () => void {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') callback();
  });
  return () => subscription.remove();
}

export function createAvatarSigner(
  getClient: () => LockInSupabaseClient,
  options: AvatarSignerOptions = {}
): AvatarSigner {
  const now = options.now ?? Date.now;
  const onStale = options.onStale ?? emitMediaStale;
  const setTimer = options.setTimer ?? defaultTimer;
  const clearTimer =
    options.clearTimer ??
    ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const onForeground = options.onForeground ?? defaultOnForeground;
  const cache = new Map<string, { url: string; expiresAt: number }>();
  let timer: unknown = null;
  let unsubscribeForeground: (() => void) | null = null;

  function staleCount(): number {
    let count = 0;
    for (const entry of cache.values()) {
      if (entry.expiresAt - now() <= REFRESH_MARGIN_MS) count += 1;
    }
    return count;
  }

  /** Programa el aviso para cuando la primera URL en caché entre en el margen. */
  function arm(minDelay: number) {
    if (timer !== null) clearTimer(timer);
    timer = null;
    if (cache.size === 0) return;
    const earliest = Math.min(...[...cache.values()].map((entry) => entry.expiresAt));
    const delay = Math.max(earliest - REFRESH_MARGIN_MS - now() + 1000, minDelay);
    timer = setTimer(() => {
      timer = null;
      // Primero se mide lo obsoleto y se avisa; solo después se expulsa lo caducado.
      // Tras una suspensión larga, expulsar antes dejaba la caché vacía, sin aviso
      // y con las pantallas montadas reteniendo URLs caducadas.
      const hadStale = staleCount() > 0;
      for (const [path, entry] of cache) if (entry.expiresAt <= now()) cache.delete(path);
      if (hadStale) onStale();
      arm(MIN_REARM_MS);
    }, delay);
  }

  function watchForeground() {
    if (unsubscribeForeground) return;
    unsubscribeForeground = onForeground(() => {
      if (staleCount() > 0) onStale();
    });
  }

  async function signPaths(paths: string[]): Promise<Map<string, string>> {
    const signed = new Map<string, string>();
    const stale: string[] = [];
    for (const path of paths) {
      const hit = cache.get(path);
      if (hit && hit.expiresAt - now() > REFRESH_MARGIN_MS) signed.set(path, hit.url);
      else stale.push(path);
    }
    if (stale.length === 0) return signed;

    try {
      const { data, error } = await getClient()
        .storage.from(BUCKET)
        .createSignedUrls(stale, SIGNED_URL_TTL_SECONDS);
      if (error || !data) return signed;
      const expiresAt = now() + SIGNED_URL_TTL_SECONDS * 1000;
      for (const entry of data) {
        if (entry.error || !entry.signedUrl || !entry.path) continue;
        cache.set(entry.path, { url: entry.signedUrl, expiresAt });
        signed.set(entry.path, entry.signedUrl);
      }
      watchForeground();
      arm(0);
    } catch {
      // Sin red o sin permiso: esas fotos salen como iniciales.
    }
    return signed;
  }

  return {
    async signProfiles<T extends Profile>(profiles: T[]): Promise<T[]> {
      const paths = [
        ...new Set(
          profiles.flatMap((profile) => (profile.avatar.imageUrl ? [profile.avatar.imageUrl] : []))
        ),
      ];
      if (paths.length === 0) return profiles;

      const signed = await signPaths(paths);
      return profiles.map((profile) => {
        const path = profile.avatar.imageUrl;
        if (!path) return profile;
        const { imageUrl: _path, ...avatar } = profile.avatar;
        const url = signed.get(path);
        // Sin URL, `hasPhoto` conserva que la foto existe: quien la pinta cae a
        // las iniciales, pero «Quitar foto» sigue disponible.
        return { ...profile, avatar: url ? { ...avatar, imageUrl: url } : avatar };
      });
    },
    clear() {
      cache.clear();
      if (timer !== null) clearTimer(timer);
      timer = null;
      unsubscribeForeground?.();
      unsubscribeForeground = null;
    },
  };
}
