/**
 * Decisión de moderación de avatares, sin Deno ni red: todo lo de fuera entra
 * por `deps`. Principio: nada se publica sin que el servidor lo haya revisado,
 * y si no se puede revisar, no se publica.
 *
 * Es JavaScript plano (ESM) a propósito: lo importan Deno (`index.ts`) y
 * `node --test` sin transpilar.
 */

export const MAX_BYTES = 5 * 1024 * 1024;

/** Umbrales sobre `category_scores`, además del `flagged` del proveedor. */
const LIMITS = { sexual: 0.4, 'violence/graphic': 0.5 };

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

/** `true` si la imagen puede publicarse. */
export function verdict({ flagged, scores }) {
  if (flagged) return false;
  if ((scores['sexual/minors'] ?? 0) > 0) return false;
  return Object.entries(LIMITS).every(([category, limit]) => (scores[category] ?? 0) < limit);
}

/**
 * @param {{ userId: string, body: unknown, deps: object }} input
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function handleAvatarRequest({ userId, body, deps }) {
  if (body?.action === 'remove') {
    const current = await deps.currentAvatarPath(userId);
    await deps.setAvatarUrl(userId, null);
    if (current) await deps.removePublic(current);
    return { status: 200, body: { avatarUrl: null } };
  }

  if (body?.action !== 'set') return { status: 400, body: { error: 'bad-request' } };
  if (!ownsPath(userId, body.path)) return { status: 403, body: { error: 'forbidden' } };

  const path = body.path;
  const bytes = await deps.downloadPending(path);
  if (!bytes || bytes.length === 0 || bytes.length > MAX_BYTES || !isJpeg(bytes)) {
    await deps.removePending(path);
    return { status: 422, body: { error: 'invalid-image' } };
  }

  let result;
  try {
    result = await deps.moderate(bytes);
  } catch {
    // Falla cerrado: sin veredicto no hay foto.
    await deps.removePending(path);
    return { status: 503, body: { error: 'unavailable' } };
  }

  if (!verdict(result)) {
    await deps.removePending(path);
    return { status: 422, body: { error: 'flagged' } };
  }

  const previous = await deps.currentAvatarPath(userId);
  const published = await deps.publish(userId, bytes);
  await deps.setAvatarUrl(userId, published.url);
  if (previous && previous !== published.path) await deps.removePublic(previous);
  await deps.removePending(path);
  return { status: 200, body: { avatarUrl: published.url } };
}
