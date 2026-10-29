/**
 * Edge Function `apple-token`: guarda el refresh token de Apple al entrar con la
 * hoja nativa de iOS (`exchange`) y lo revoca antes de borrar la cuenta
 * (`revoke`), como pide la norma 5.1.1(v) de la App Store. Sin lógica propia: la
 * decisión y la firma del `client_secret` viven en `logic.mjs` (con tests); aquí
 * solo se cablean la sesión, la tabla privada `apple_refresh_tokens` y Apple.
 *
 * Secretos (los pone una persona en el dashboard; nunca están en el repo):
 * `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (el contenido del .p8) y
 * `APPLE_CLIENT_ID` (`app.cofounder.mobile`). Sin ellos responde 200 con
 * `reason: 'unconfigured'` y no hace nada. `SUPABASE_URL` y
 * `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase. Se despliega con
 * `verify_jwt: true`.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { handleAppleTokenRequest, readConfig } from './logic.mjs';

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

async function post(url: string, form: Record<string, string>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return json(405, { error: 'method' });

  // `verify_jwt` ya ha validado la firma; aquí se saca QUIÉN es.
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json(401, { error: 'unauthorized' });

  // El `sub` de Apple de cada identidad `apple` de la cuenta: el canje solo se
  // guarda si el `id_token` que devuelve Apple es de una de ellas.
  const appleSubjects = (auth.user.identities ?? [])
    .filter((identity) => identity.provider === 'apple')
    .flatMap((identity) => [identity.identity_data?.sub, identity.id])
    .filter((sub): sub is string => typeof sub === 'string' && sub.length > 0);

  const body = await request.json().catch(() => null);

  const result = await handleAppleTokenRequest({
    userId: auth.user.id,
    appleSubjects,
    body,
    config: readConfig(Deno.env.toObject()),
    deps: {
      post,
      async saveRefreshToken(userId: string, refreshToken: string) {
        const { error } = await admin
          .from('apple_refresh_tokens')
          .upsert(
            { user_id: userId, refresh_token: refreshToken, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          );
        if (error) throw error;
      },
      async loadRefreshToken(userId: string) {
        const { data, error } = await admin
          .from('apple_refresh_tokens')
          .select('refresh_token')
          .eq('user_id', userId)
          .maybeSingle();
        if (error) throw error;
        return (data?.refresh_token as string | undefined) ?? null;
      },
      async deleteRefreshToken(userId: string) {
        const { error } = await admin.from('apple_refresh_tokens').delete().eq('user_id', userId);
        if (error) throw error;
      },
      log(message: string) {
        console.warn(`[apple-token] ${auth.user.id}: ${message}`);
      },
    },
  });

  return json(result.status, result.body);
});
