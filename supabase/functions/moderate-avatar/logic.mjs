/**
 * Decisión de moderación de avatares, sin Deno ni red: todo lo de fuera entra
 * por `deps`. Principio: nada se publica sin que el servidor lo haya revisado,
 * y si no se puede revisar, no se publica.
 *
 * Es JavaScript plano (ESM) a propósito: lo importan Deno (`index.ts`) y
 * `node --test` sin transpilar.
 *
 * `deps`:
 * - `downloadPending(path)` → bytes | null
 * - `moderate(bytes)` → `{ flagged, scores }` (lanza si el proveedor falla)
 * - `publish(userId, bytes)` → `{ path }` (el bucket `avatars` es PRIVADO: no hay URL
 *   pública; la referencia es la ruta y el cliente la firma al leer)
 * - `currentAvatar(userId)` → `{ path }` (nulo sin foto; lanza si no se puede leer)
 * - `setAvatarPath(userId, path, expectedPath)` → boolean. Escribe `profiles.avatar_url`,
 *   que guarda la ruta. Con `expectedPath`
 *   definido es condicional (solo si `avatar_url` sigue siendo esa): `false`
 *   significa que otra petición se adelantó. Sin él, incondicional.
 * - `removePublic(path)` (lanza si Storage lo rechaza), `removePending(path)`,
 *   `removeAllPending(userId)`.
 */

export const MAX_BYTES = 5 * 1024 * 1024;

/** Umbrales sobre `category_scores`, además del `flagged` del proveedor. */
const LIMITS = { sexual: 0.4, 'violence/graphic': 0.5 };

/** Sin estas tres categorías con número, la respuesta no vale para decidir. */
const REQUIRED = ['sexual', 'sexual/minors', 'violence/graphic'];

/** JPEG de verdad: lo dicen los primeros bytes, no la extensión. */
export function isJpeg(bytes) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** `<uid>/<nombre>.jpg`: una sola carpeta, la propia, sin `..` ni subcarpetas. */
export function ownsPath(userId, path) {
  if (typeof path !== 'string') return false;
  const match = /^([^/]+)\/([A-Za-z0-9._-]+\.jpg)$/.exec(path);
  return match !== null && match[1] === userId && !match[2].includes('..');
}

/**
 * ¿Trae el proveedor todo lo necesario para decidir? Una categoría ausente se
 * leería como 0 y dejaría pasar la imagen: por eso se exige, no se asume.
 */
export function isComplete(result) {
  return (
    typeof result?.flagged === 'boolean' &&
    typeof result.scores === 'object' &&
    result.scores !== null &&
    REQUIRED.every((category) => Number.isFinite(result.scores[category]))
  );
}

/** `true` si la imagen puede publicarse. Presupone `isComplete(result)`. */
export function verdict({ flagged, scores }) {
  if (flagged) return false;
  if ((scores['sexual/minors'] ?? 0) > 0) return false;
  return Object.entries(LIMITS).every(([category, limit]) => (scores[category] ?? 0) < limit);
}

const UNAVAILABLE = { status: 503, body: { error: 'unavailable' } };

async function quietly(promise) {
  try {
    await promise;
  } catch {
    // Mejor esfuerzo: un archivo huérfano es el mal menor.
  }
}

async function remove(userId, deps) {
  const current = await deps.currentAvatar(userId);
  // Primero el archivo, y solo si Storage lo confirma, la referencia: si el
  // borrado falla, `avatar_url` sigue apuntando y «quitar» se puede reintentar.
  if (current.path) await deps.removePublic(current.path);
  await deps.setAvatarPath(userId, null, undefined);
  // Lo que una subida cortada dejó en pendientes también se va con la foto.
  await quietly(deps.removeAllPending(userId));
  return { status: 200, body: { avatarPath: null } };
}

async function publishIfClean(userId, path, deps) {
  const bytes = await deps.downloadPending(path);
  if (!bytes || bytes.length === 0 || bytes.length > MAX_BYTES || !isJpeg(bytes)) {
    return { status: 422, body: { error: 'invalid-image' } };
  }

  let result;
  try {
    result = await deps.moderate(bytes);
  } catch {
    return UNAVAILABLE;
  }
  // Falla cerrado: una respuesta a medias no es un «sí».
  if (!isComplete(result)) return UNAVAILABLE;
  if (!verdict(result)) return { status: 422, body: { error: 'flagged' } };

  const previous = await deps.currentAvatar(userId);
  const published = await deps.publish(userId, bytes);

  let applied;
  try {
    applied = await deps.setAvatarPath(userId, published.path, previous.path);
  } catch {
    applied = null;
  }
  if (applied !== true) {
    // Lo publicado no quedó asociado a nadie: se retira para que no sea un
    // archivo huérfano en el bucket.
    await quietly(deps.removePublic(published.path));
    return applied === false ? { status: 409, body: { error: 'conflict' } } : UNAVAILABLE;
  }

  if (previous.path && previous.path !== published.path) {
    await quietly(deps.removePublic(previous.path));
  }
  return { status: 200, body: { avatarPath: published.path } };
}

/**
 * @param {{ userId: string, body: unknown, deps: object }} input
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function handleAvatarRequest({ userId, body, deps }) {
  try {
    if (body?.action === 'remove') return await remove(userId, deps);

    if (body?.action !== 'set') return { status: 400, body: { error: 'bad-request' } };
    if (!ownsPath(userId, body.path)) return { status: 403, body: { error: 'forbidden' } };

    try {
      return await publishIfClean(userId, body.path, deps);
    } finally {
      // Sea cual sea el desenlace, la subida pendiente no se queda.
      await quietly(deps.removePending(body.path));
    }
  } catch {
    // Cualquier fallo inesperado deja la foto sin publicar.
    return UNAVAILABLE;
  }
}
