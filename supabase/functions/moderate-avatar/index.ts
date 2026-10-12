/**
 * Edge Function `moderate-avatar`: la única puerta por la que una foto llega a
 * `avatars` y a `profiles.avatar_url`. Sin lógica propia: la decisión vive en
 * `logic.mjs` (con tests); aquí solo se cablean Storage, `profiles` y OpenAI.
 *
 * Secretos: `OPENAI_API_KEY` (lo pone una persona en el dashboard; nunca está en
 * el repo). `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase.
 * Se despliega con `verify_jwt: true`.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { handleAvatarRequest } from './logic.mjs';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/avatars/`;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function moderate(bytes: Uint8Array) {
  if (!OPENAI_API_KEY) throw new Error('sin OPENAI_API_KEY');

  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);

  const response = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'omni-moderation-latest',
      input: [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${btoa(binary)}` } }],
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`moderación ${response.status}`);

  const result = (await response.json())?.results?.[0];
  if (typeof result?.flagged !== 'boolean' || typeof result?.category_scores !== 'object') {
    throw new Error('respuesta de moderación inesperada');
  }
  return {
    flagged: result.flagged as boolean,
    scores: result.category_scores as Record<string, number>,
  };
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method' });

  // `verify_jwt` ya ha validado la firma; aquí se saca QUIÉN es.
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user || auth.user.is_anonymous) {
    return json(401, { error: 'unauthorized' });
  }

  const body = await request.json().catch(() => null);

  try {
    const result = await handleAvatarRequest({
      userId: auth.user.id,
      body,
      deps: {
        async downloadPending(path: string) {
          const { data, error } = await admin.storage.from('avatar-uploads').download(path);
          return error || !data ? null : new Uint8Array(await data.arrayBuffer());
        },
        moderate,
        async publish(userId: string, bytes: Uint8Array) {
          const path = `${userId}/${crypto.randomUUID()}.jpg`;
          const { error } = await admin.storage
            .from('avatars')
            .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
          if (error) throw error;
          return { path, url: `${PUBLIC_PREFIX}${path}` };
        },
        async currentAvatarPath(userId: string) {
          const { data } = await admin
            .from('profiles')
            .select('avatar_url')
            .eq('id', userId)
            .single();
          const url = data?.avatar_url as string | null | undefined;
          return url?.startsWith(PUBLIC_PREFIX) ? url.slice(PUBLIC_PREFIX.length) : null;
        },
        async setAvatarUrl(userId: string, url: string | null) {
          const { error } = await admin
            .from('profiles')
            .update({ avatar_url: url })
            .eq('id', userId);
          if (error) throw error;
        },
        async removePublic(path: string) {
          await admin.storage.from('avatars').remove([path]);
        },
        async removePending(path: string) {
          await admin.storage.from('avatar-uploads').remove([path]);
        },
      },
    });
    return json(result.status, result.body);
  } catch {
    // Cualquier fallo inesperado deja la foto sin publicar.
    return json(503, { error: 'unavailable' });
  }
});
