/**
 * Tablón personal contra Supabase (2026-10-17). Como `avatar.ts`: la foto se sube
 * a pendientes (`avatar-uploads/<uid>/…`, con sus políticas) y la Edge Function
 * `moderate-board` la modera junto con el pie y la publica en el bucket privado
 * `board`. Leer: filas de `board_posts` (RLS ya esconde lo de alguien con
 * bloqueo) y URLs firmadas de una hora.
 */

import { BoardRejectedError, type BoardRejectedReason } from '../repositories';

import { readLocalImage } from './avatar-file';

import type { LockInSupabaseClient } from './client';
import type { BoardPost } from '../types';

const UPLOADS = 'avatar-uploads';
const BUCKET = 'board';
const FUNCTION = 'moderate-board';
const SIGNED_TTL_S = 60 * 60;

type PostRow = {
  id: string;
  owner_id: string;
  image_path: string;
  caption: string;
  created_at: string;
};

function newName(): string {
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${id}.jpg`;
}

async function reasonOf(error: unknown): Promise<BoardRejectedReason> {
  const context = (error as { context?: { json?: () => Promise<{ error?: string }> } } | null)
    ?.context;
  try {
    const body = await context?.json?.();
    if (
      body?.error === 'flagged' ||
      body?.error === 'invalid-image' ||
      body?.error === 'board-full'
    ) {
      return body.error;
    }
  } catch {
    // Cuerpo ilegible: se trata como «no disponible».
  }
  return 'unavailable';
}

export async function listBoardPosts(
  client: LockInSupabaseClient,
  ownerId: string
): Promise<BoardPost[]> {
  const { data, error } = await client
    .from('board_posts')
    .select('id, owner_id, image_path, caption, created_at')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as PostRow[];
  if (rows.length === 0) return [];

  const { data: signed } = await client.storage.from(BUCKET).createSignedUrls(
    rows.map((row) => row.image_path),
    SIGNED_TTL_S
  );
  const urls = new Map((signed ?? []).map((entry) => [entry.path, entry.signedUrl ?? null]));

  return rows.map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    imageUrl: urls.get(row.image_path) ?? null,
    caption: row.caption,
    createdAt: row.created_at,
  }));
}

export async function addBoardPost(
  client: LockInSupabaseClient,
  userId: string,
  localUri: string,
  caption: string
): Promise<BoardPost> {
  const { bytes, contentType } = await readLocalImage(localUri);

  const path = `${userId}/${newName()}`;
  const { error: uploadError } = await client.storage
    .from(UPLOADS)
    .upload(path, bytes, { contentType, upsert: false });
  if (uploadError) throw new Error('No se ha podido subir la foto. Inténtalo de nuevo.');

  const { data, error } = await client.functions.invoke(FUNCTION, {
    body: { action: 'add', path, caption },
  });
  const post = data?.post as
    | { id: string; ownerId: string; imagePath: string; caption: string; createdAt: string }
    | undefined;
  if (error || typeof post?.id !== 'string') {
    throw new BoardRejectedError(await reasonOf(error));
  }

  const { data: signed } = await client.storage
    .from(BUCKET)
    .createSignedUrl(post.imagePath, SIGNED_TTL_S);
  return {
    id: post.id,
    ownerId: post.ownerId,
    imageUrl: signed?.signedUrl ?? null,
    caption: post.caption,
    createdAt: post.createdAt,
  };
}

export async function removeBoardPost(client: LockInSupabaseClient, postId: string): Promise<void> {
  const { error } = await client.functions.invoke(FUNCTION, {
    body: { action: 'remove', postId },
  });
  if (error) throw new Error('No se ha podido quitar la foto. Inténtalo de nuevo.');
}
