/**
 * Foto de perfil en Storage, siempre a través de la moderación del servidor.
 *
 * El cliente solo puede dejar el archivo en `avatar-uploads/<uid>/` (privado);
 * publicarlo en `avatars` y apuntar `profiles.avatar_url` es cosa de la Edge
 * Function `moderate-avatar`, que revisa la imagen antes. Si la revisión no se
 * puede hacer, la foto se rechaza: nunca se publica sin escanear.
 */

import { readLocalImage } from './avatar-file';

import type { LockInSupabaseClient } from './client';

const UPLOADS = 'avatar-uploads';
const FUNCTION = 'moderate-avatar';

export type AvatarRejectedReason = 'flagged' | 'invalid-image' | 'conflict' | 'unavailable';

const MESSAGES: Record<AvatarRejectedReason, string> = {
  flagged: 'Esta foto no cumple las normas de la comunidad. Prueba con otra.',
  'invalid-image': 'No hemos podido usar esa imagen. Prueba con otra foto.',
  conflict: 'Tu foto ha cambiado a la vez desde otro sitio. Inténtalo de nuevo.',
  unavailable: 'No hemos podido revisar la foto ahora mismo. Inténtalo más tarde.',
};

/** La foto no se ha publicado. `message` ya está listo para enseñarse. */
export class AvatarRejectedError extends Error {
  readonly reason: AvatarRejectedReason;

  constructor(reason: AvatarRejectedReason) {
    super(MESSAGES[reason]);
    this.name = 'AvatarRejectedError';
    this.reason = reason;
  }
}

function newName(): string {
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${id}.jpg`;
}

/** Qué dijo la función: rechazo por contenido, imagen inválida, carrera, o «no disponible». */
async function reasonOf(error: unknown): Promise<AvatarRejectedReason> {
  const context = (error as { context?: { json?: () => Promise<{ error?: string }> } } | null)
    ?.context;
  try {
    const body = await context?.json?.();
    if (
      body?.error === 'flagged' ||
      body?.error === 'invalid-image' ||
      body?.error === 'conflict'
    ) {
      return body.error;
    }
  } catch {
    // Cuerpo ilegible: se trata como «no disponible».
  }
  return 'unavailable';
}

/** Sube la foto a pendientes y pide que se publique. Devuelve la RUTA publicada (el bucket es privado: se firma al leer). */
export async function uploadAvatar(
  client: LockInSupabaseClient,
  userId: string,
  localUri: string
): Promise<string> {
  const { bytes, contentType } = await readLocalImage(localUri);

  const path = `${userId}/${newName()}`;
  const { error: uploadError } = await client.storage
    .from(UPLOADS)
    .upload(path, bytes, { contentType, upsert: false });
  if (uploadError) throw new Error('No se ha podido subir la foto. Inténtalo de nuevo.');

  const { data, error } = await client.functions.invoke(FUNCTION, {
    body: { action: 'set', path },
  });
  if (error || typeof data?.avatarPath !== 'string') {
    // Falla cerrado: sea rechazo o caída, no hay foto nueva.
    throw new AvatarRejectedError(await reasonOf(error));
  }

  return data.avatarPath;
}

/** Quita la foto publicada (y apaga `avatar_url`, que guarda la ruta): solo la función puede. */
export async function deleteAvatar(client: LockInSupabaseClient): Promise<void> {
  const { error } = await client.functions.invoke(FUNCTION, { body: { action: 'remove' } });
  if (error) throw new AvatarRejectedError('unavailable');
}
