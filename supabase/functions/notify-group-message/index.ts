/**
 * Edge Function `notify-group-message`: la llama el trigger `group_messages_push`
 * (por `pg_net`) con `{ message_id }` cada vez que alguien escribe en un chat de
 * grupo, y manda el aviso push a los demás miembros por la API de Expo. Sin
 * lógica propia: vive en `logic.mjs` (con tests). Reutiliza
 * `../revenuecat-webhook/logic.mjs` (al desplegar por MCP hay que subirlo como
 * archivo con ese nombre, igual que en `revenuecat-webhook`). Incluir también
 * `copy.mjs` y `../sync-entitlement/logic.mjs` (dependencia de RevenueCat).
 * Despacha todos los avisos a los RPC service_role, sin destinatarios
 * ni textos proporcionados por quien llama. La URL y los secretos no cambian.
 *
 * Secreto ya existente (se reutiliza; nunca está en el repo): `PUSH_WEBHOOK_SECRET`,
 * el mismo valor que el secreto `push_webhook_secret` de Vault. Sin él responde
 * 503. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase. Se
 * despliega con `verify_jwt: false`: Postgres no manda JWT.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { EXPO_PUSH_URL, handlePushRequest, readConfig } from './logic.mjs';
import { cleanRetiredProjectMedia } from '../_shared/retired-project-media.mjs';

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

  const body = await request.json().catch(() => null);
  try {
    const result = await handlePushRequest({
      secretHeader: request.headers.get('x-push-secret'),
      body,
      config: readConfig(Deno.env.toObject()),
      deps: {
        cleanRetiredMedia: () => cleanRetiredProjectMedia(admin),
        async targets(id: string | null, type: string) {
          const dispatch: Record<string, [string, Record<string, string | null>]> = {
            'group-message': ['group_message_push_targets', { p_message_id: id! }],
            'direct-message': ['direct_message_push_targets', { p_message_id: id! }],
            match: ['match_push_targets', { p_match_id: id! }],
            'group-activity': ['group_activity_push_targets', { p_event_id: id! }],
            'project-event': ['project_push_targets', { p_event_id: id! }],
            'project-reminders': ['project_push_targets', { p_event_id: null }],
            'like-digest': ['like_digest_push_targets', {}],
            reengagement: ['reengagement_push_targets', {}],
            'premium-expiry': ['premium_expiry_push_targets', {}],
          };
          const [name, args] = dispatch[type];
          const { data, error } = await admin.rpc(name, args);
          if (error) throw error;
          return data ?? [];
        },
        async sendToExpo(messages: unknown[]) {
          const response = await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(messages),
            signal: AbortSignal.timeout(10_000),
          });
          return { status: response.status, body: await response.json().catch(() => null) };
        },
        async forgetTokens(tokens: string[]) {
          const { error } = await admin.rpc('forget_push_tokens', { p_tokens: tokens });
          if (error) throw error;
        },
        async completeNotices(ids: string[], type: string) {
          const rpc =
            type === 'project-event' || type === 'project-reminders'
              ? 'complete_project_push'
              : 'complete_push_notices';
          const { error } = await admin.rpc(rpc, { p_notice_ids: ids });
          if (error) throw error;
        },
        log: (...args: unknown[]) => console.warn('[notify-group-message]', ...args),
      },
    });
    return json(result.status, result.body);
  } catch (cause) {
    console.error('[notify-group-message]', cause);
    return json(500, { error: 'internal' });
  }
});
