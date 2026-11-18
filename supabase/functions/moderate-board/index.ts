/**
 * Edge Function `moderate-board`: la única puerta por la que una foto llega al
 * tablón personal (bucket PRIVADO `board` y tabla `board_posts`). Sin lógica
 * propia: la decisión vive en `logic.mjs` (con tests); aquí solo se cablean
 * Storage, `board_posts` y OpenAI. Mismo patrón que `moderate-avatar`.
 *
 * Secretos: `OPENAI_API_KEY` (el mismo de `moderate-avatar`, en el dashboard).
 * `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase. Se despliega
 * con `verify_jwt: true`.
 */

import { moderateBoardImage as moderate } from '../_shared/moderate-board-image.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { BoardFullError, handleBoardRequest } from './logic.mjs';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

type PostRow = {
  id: string;
  owner_id: string;
  image_path: string;
  caption: string;
  created_at: string;
};

const toPost = (row: PostRow) => ({
  id: row.id,
  ownerId: row.owner_id,
  imagePath: row.image_path,
  caption: row.caption,
  createdAt: row.created_at,
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return json(405, { error: 'method' });

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user || auth.user.is_anonymous) {
    return json(401, { error: 'unauthorized' });
  }

  const body = await request.json().catch(() => null);

  const result = await handleBoardRequest({
    userId: auth.user.id,
    body,
    deps: {
      async countPosts(userId: string) {
        const { count, error } = await admin
          .from('board_posts')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', userId);
        if (error) throw error;
        return count ?? 0;
      },
      async downloadPending(path: string) {
        const { data, error } = await admin.storage.from('avatar-uploads').download(path);
        return error || !data ? null : new Uint8Array(await data.arrayBuffer());
      },
      moderate,
      async publish(userId: string, bytes: Uint8Array) {
        const path = `${userId}/${crypto.randomUUID()}.jpg`;
        const { error } = await admin.storage
          .from('board')
          .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
        if (error) throw error;
        return { path };
      },
      async insertPost(userId: string, path: string, caption: string) {
        const { data, error } = await admin
          .from('board_posts')
          .insert({ owner_id: userId, image_path: path, caption })
          .select('id, owner_id, image_path, caption, created_at')
          .single();
        // `LI010`: el trigger del tope (`board_posts_enforce_max`).
        if (error?.code === 'LI010') throw new BoardFullError('board-full');
        if (error) throw error;
        return toPost(data as PostRow);
      },
      async findPost(id: string) {
        const { data, error } = await admin
          .from('board_posts')
          .select('id, owner_id, image_path, caption, created_at')
          .eq('id', id)
          .maybeSingle();
        // Un id que no es uuid es un 22P02: lo mismo que «no existe».
        if (error) return null;
        return data ? toPost(data as PostRow) : null;
      },
      async listOwnPosts(userId: string) {
        const { data, error } = await admin
          .from('board_posts')
          .select('id, owner_id, image_path, caption, created_at')
          .eq('owner_id', userId);
        if (error) throw error;
        return ((data ?? []) as PostRow[]).map(toPost);
      },
      async deletePost(id: string) {
        const { error } = await admin.from('board_posts').delete().eq('id', id);
        if (error) throw error;
      },
      async removePublic(path: string) {
        const { error } = await admin.storage.from('board').remove([path]);
        if (error) throw error;
      },
      async removePending(path: string) {
        const { error } = await admin.storage.from('avatar-uploads').remove([path]);
        if (error) throw error;
      },
    },
  });

  return json(result.status, result.body);
});
