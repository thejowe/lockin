/**
 * Edge Function `sync-entitlement`: tras comprar o restaurar, el cliente la llama
 * y ella pregunta a la API REST de RevenueCat por el estado de SU uid y escribe
 * `entitlements`. La UI se desbloquea cuando `premium_quotas()` dice
 * `is_premium`, no cuando lo dice el SDK. La lógica vive en `logic.mjs`.
 *
 * Secreto (lo pone una persona en el dashboard; nunca está en el repo):
 * `REVENUECAT_SECRET_KEY` (clave REST secreta de RevenueCat). Sin él responde 200
 * con `reason: 'unconfigured'`. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los
 * inyecta Supabase. Se despliega con `verify_jwt: true`.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { handleSyncRequest, readConfig, subscriberUrl } from './logic.mjs';

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

  const config = readConfig(Deno.env.toObject());

  const result = await handleSyncRequest({
    userId: auth.user.id,
    config,
    deps: {
      async fetchSubscriber(appUserId: string) {
        const response = await fetch(subscriberUrl(appUserId), {
          headers: { Authorization: `Bearer ${config!.apiKey}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(10_000),
        });
        return { status: response.status, body: await response.json().catch(() => null) };
      },
      async saveEntitlement(
        userId: string,
        e: {
          premiumUntil: string | null;
          productId: string | null;
          store: string | null;
          snapshotAt: string;
        }
      ) {
        const { error } = await admin.rpc('save_entitlement', {
          p_user: userId,
          p_premium_until: e.premiumUntil,
          p_product_id: e.productId,
          p_store: e.store,
          p_snapshot_at: e.snapshotAt,
        });
        if (error) throw error;
      },
      log(message: string) {
        console.warn(`[sync-entitlement] ${auth.user.id}: ${message}`);
      },
    },
  });

  return json(result.status, result.body);
});
