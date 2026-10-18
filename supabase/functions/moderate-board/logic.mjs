/**
 * Decisión de `moderate-board` (el tablón personal, 2026-10-17), sin Deno ni
 * red: todo lo de fuera entra por `deps`, para poder probarla con `node --test`.
 *
 * Reutiliza la lógica ya probada de la foto de perfil (`../moderate-avatar`):
 * qué es un JPEG, qué ruta es de quién y cuándo una moderación deja publicar.
 *
 * Dos acciones:
 * - `add` { path, caption }: la foto pendiente de `avatar-uploads/<uid>/…`, más
 *   un pie de hasta 280 caracteres. Se moderan JUNTOS (la foto y el texto) y,
 *   si pasan, se publica en `board` y se inserta la fila. Tope de MAX_POSTS.
 * - `remove` { postId }: quita la foto y su fila, solo si es de quien pide.
 * - `remove-all`: todo el tablón propio (antes de borrar la cuenta).
 *
 * Falla cerrado: sin moderación completa no se publica nada.
 */

import { MAX_BYTES, isComplete, isJpeg, ownsPath } from '../moderate-avatar/logic.mjs';

export const MAX_POSTS = 12;
export const MAX_CAPTION = 280;

const UNAVAILABLE = { status: 503, body: { error: 'unavailable' } };
const FULL = { status: 409, body: { error: 'board-full' } };

/**
 * Umbrales del tablón. Los de la foto de perfil exigen `sexual/minors` a CERO
 * exacto, que con una sola imagen es lo que devuelve el proveedor; aquí se
 * modera también el pie, y con texto esa categoría trae valores diminutos sin
 * estar marcada (codex review del 2026-10-17). Un umbral bajo, no cero.
 */
const LIMITS = { sexual: 0.4, 'sexual/minors': 0.01, 'violence/graphic': 0.5 };

/** `true` si foto y pie pueden publicarse. Presupone `isComplete(result)`. */
export function boardVerdict({ flagged, scores }) {
  if (flagged) return false;
  return Object.entries(LIMITS).every(([category, limit]) => (scores[category] ?? 0) < limit);
}

/** Marca de `insertPost` cuando la base dice que el tablón ya está lleno. */
export class BoardFullError extends Error {}

async function quietly(promise) {
  try {
    await promise;
  } catch {
    // Mejor esfuerzo: un archivo huérfano es el mal menor.
  }
}

/** El pie, limpio: texto, sin espacios de sobra, con tope. `null` si no vale. */
export function cleanCaption(caption) {
  if (caption === undefined || caption === null) return '';
  if (typeof caption !== 'string') return null;
  const value = caption.trim();
  return value.length <= MAX_CAPTION ? value : null;
}

async function add(userId, body, deps) {
  if (!ownsPath(userId, body.path)) return { status: 403, body: { error: 'forbidden' } };
  const caption = cleanCaption(body.caption);
  if (caption === null) return { status: 422, body: { error: 'invalid-caption' } };

  // Atajo amable para no moderar en balde; el tope de verdad lo pone la base
  // (trigger `board_posts_enforce_max`), que no tiene carreras.
  if ((await deps.countPosts(userId)) >= MAX_POSTS) return FULL;

  const bytes = await deps.downloadPending(body.path);
  if (!bytes || bytes.length === 0 || bytes.length > MAX_BYTES || !isJpeg(bytes)) {
    return { status: 422, body: { error: 'invalid-image' } };
  }

  let result;
  try {
    result = await deps.moderate(bytes, caption);
  } catch {
    return UNAVAILABLE;
  }
  if (!isComplete(result)) return UNAVAILABLE;
  if (!boardVerdict(result)) return { status: 422, body: { error: 'flagged' } };

  const published = await deps.publish(userId, bytes);
  let post;
  let full = false;
  try {
    post = await deps.insertPost(userId, published.path, caption);
  } catch (cause) {
    post = null;
    full = cause instanceof BoardFullError;
  }
  if (!post) {
    // Lo publicado no quedó asociado a nadie: fuera, para no dejar huérfanos.
    await quietly(deps.removePublic(published.path));
    return full ? FULL : UNAVAILABLE;
  }
  return { status: 200, body: { post } };
}

async function remove(userId, body, deps) {
  if (typeof body.postId !== 'string' || body.postId.length === 0) {
    return { status: 400, body: { error: 'bad-request' } };
  }
  const post = await deps.findPost(body.postId);
  // De otro o inexistente: lo mismo, para no contar qué ids existen.
  if (!post || post.ownerId !== userId) return { status: 404, body: { error: 'not-found' } };

  // Primero el archivo y, solo si Storage lo confirma, la fila: si el archivo
  // falla, la fila sigue y «quitar» se puede reintentar (al revés quedaría un
  // archivo sin fila que ya nadie podría borrar desde la app).
  await deps.removePublic(post.imagePath);
  await deps.deletePost(post.id);
  return { status: 200, body: { removed: post.id } };
}

/** Todo el tablón de quien pide: lo usa «Eliminar mi cuenta» antes del RPC. */
async function removeAll(userId, deps) {
  const posts = await deps.listOwnPosts(userId);
  for (const post of posts) {
    await deps.removePublic(post.imagePath);
    await deps.deletePost(post.id);
  }
  return { status: 200, body: { removed: posts.length } };
}

export async function handleBoardRequest({ userId, body, deps }) {
  try {
    if (body?.action === 'remove') return await remove(userId, body, deps);
    if (body?.action === 'remove-all') return await removeAll(userId, deps);
    if (body?.action !== 'add') return { status: 400, body: { error: 'bad-request' } };
    try {
      return await add(userId, body, deps);
    } finally {
      // Sea cual sea el desenlace, la subida pendiente no se queda.
      if (typeof body.path === 'string' && ownsPath(userId, body.path)) {
        await quietly(deps.removePending(body.path));
      }
    }
  } catch {
    return UNAVAILABLE;
  }
}
