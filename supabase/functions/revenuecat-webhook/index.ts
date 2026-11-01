/**
 * Edge Function `revenuecat-webhook`: recibe los eventos de RevenueCat y deja
 * `entitlements` al día. Sin lógica propia: vive en `logic.mjs` (con tests).
 * Reutiliza `../sync-entitlement/logic.mjs` (al desplegar por MCP hay que subirlo
 * como archivo con ese nombre, igual que `moderate-avatar/logic.mjs`).
 *
 * Secretos (los pone una persona en el dashboard; nunca están en el repo):
 * `REVENUECAT_WEBHOOK_SECRET` (el valor de la cabecera Authorization que se
 * configura en RevenueCat) y `REVENUECAT_SECRET_KEY` (clave REST secreta). Sin
 * ellos responde 503. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta
 * Supabase. Se despliega con `verify_jwt: false`: RevenueCat no manda JWT.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { subscriberUrl } from '../sync-entitlement/logic.mjs';
import { handleWebhookRequest, readConfig } from './logic.mjs';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method' });

  const config = readConfig(Deno.env.toObject());
  const body = await request.json().catch(() => null);

  const result = await handleWebhookRequest({
    authorization: request.headers.get('Authorization'),
    body,
    config,
    deps: {
      async hasSeenEvent(eventId: string) {
        const { data, error } = await admin
          .from('revenuecat_events')
          .select('event_id')
          .eq('event_id', eventId)
          .maybeSingle();
        if (error) throw error;
        return data !== null;
      },
      async markEventSeen(eventId: string) {
        const { error } = await admin
          .from('revenuecat_events')
          .upsert({ event_id: eventId }, { onConflict: 'event_id', ignoreDuplicates: true });
        if (error) throw error;
      },
      async profileExists(userId: string) {
        const { data, error } = await admin
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle();
        if (error) throw error;
        return data !== null;
      },
      async fetchSubscriber(appUserId: string) {
        const response = await fetch(subscriberUrl(appUserId), {
          headers: { Authorization: `Bearer ${config!.apiKey}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(10_000),
        });
        return { status: response.status, body: await response.json().catch(() => null) };
      },
      async saveEntitlement(
        userId: string,
        e: { premiumUntil: string | null; productId: string | null; store: string | null }
      ) {
        const { error } = await admin.from('entitlements').upsert(
          {
            user_id: userId,
            premium_until: e.premiumUntil,
            product_id: e.productId,
            store: e.store,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
        if (error) throw error;
      },
      log(message: string) {
        console.warn(`[revenuecat-webhook] ${message}`);
      },
    },
  });

  return json(result.status, result.body);
});
