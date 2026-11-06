/**
 * Edge Function `verify-identity`: pone el sello «Verificado en GitHub/LinkedIn».
 *
 * El cliente la llama justo después de canjear el code de `linkIdentity`, con el
 * `provider_token` que devuelve ese canje. Aquí se pregunta a la API del
 * proveedor de quién es el token, y el RPC `seal_identity_verification`
 * (service role) solo sella si la cuenta tiene una identidad de ese proveedor
 * con ese `provider_id`. La lógica vive en `logic.mjs`; el porqué, en la
 * migración 20261106140000.
 *
 * Sin secretos propios: `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta
 * Supabase. Se despliega con `verify_jwt: true`.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { handleVerifyRequest } from './logic.mjs';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return json(405, { error: 'method' });

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json(401, { error: 'unauthorized' });

  const body = await request.json().catch(() => null);

  const result = await handleVerifyRequest({
    userId: auth.user.id,
    body,
    deps: {
      async fetchProviderUser(url: string, providerToken: string) {
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${providerToken}`,
            Accept: 'application/json',
            // GitHub rechaza peticiones sin User-Agent.
            'User-Agent': 'cofounder-verify-identity',
          },
          signal: AbortSignal.timeout(10_000),
        });
        return { status: response.status, body: await response.json().catch(() => null) };
      },
      async seal(userId: string, provider: string, providerId: string) {
        const { data, error } = await admin.rpc('seal_identity_verification', {
          p_user: userId,
          p_provider: provider,
          p_provider_id: providerId,
        });
        if (error) throw error;
        return data === true;
      },
      log(message: string) {
        console.warn(`[verify-identity] ${auth.user.id}: ${message}`);
      },
    },
  });

  return json(result.status, result.body);
});
