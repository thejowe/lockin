/**
 * Webhook de RevenueCat → `entitlements`. Sin Deno ni red: todo lo de fuera entra
 * por `deps`. Spec: `docs/superpowers/specs/2026-10-26-premium-design.md` §4.
 *
 * - Autenticación: la cabecera `Authorization` debe ser el secreto compartido
 *   (tal cual, o como `Bearer <secreto>`), comparado en tiempo constante.
 * - Idempotencia: el `event.id` se apunta en `revenuecat_events` SOLO tras
 *   procesar bien; si la API falla se responde 5xx y el reintento de RevenueCat
 *   no queda descartado por haberlo apuntado antes.
 * - No se fía del cuerpo: el evento solo dice A QUIÉN mirar; el estado (y por
 *   tanto `premium_until`) sale de la API REST (`refreshEntitlement`). Así el
 *   orden de llegada de los eventos da igual.
 * - `app_user_id` que no es uuid (anónimos) o sin perfil (cuenta borrada): 200 y
 *   nada que hacer, para que RevenueCat no reintente.
 *
 * `deps` (además de `fetchSubscriber`, `saveEntitlement` y `log` de
 * `../sync-entitlement/logic.mjs`):
 * - `hasSeenEvent(eventId)` → boolean y `markEventSeen(eventId)`: `revenuecat_events`.
 * - `profileExists(userId)` → boolean.
 */

import { isUserId, refreshEntitlement } from '../sync-entitlement/logic.mjs';

/** Eventos tras los que puede haber cambiado el estado del entitlement. */
export const RELEVANT_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'CANCELLATION',
  'UNCANCELLATION',
  'EXPIRATION',
  'BILLING_ISSUE',
  'PRODUCT_CHANGE',
  'SUBSCRIPTION_EXTENDED',
  'SUBSCRIPTION_PAUSED',
  'TRANSFER',
  'REFUND_REVERSED',
  'TEMPORARY_ENTITLEMENT_GRANT',
]);

const encoder = new TextEncoder();

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

/** Comparación en tiempo constante: se comparan los hashes, así ni la longitud se filtra. */
export async function secretMatches(header, secret) {
  if (typeof header !== 'string' || typeof secret !== 'string' || secret === '') return false;
  const expected = await digest(secret);
  let ok = false;
  for (const candidate of [header, header.replace(/^Bearer\s+/i, '')]) {
    const actual = await digest(candidate);
    let diff = 0;
    for (let i = 0; i < expected.length; i += 1) diff |= expected[i] ^ actual[i];
    if (diff === 0) ok = true;
  }
  return ok;
}

/** El secreto del webhook y la clave REST, o `null` si falta alguno. */
export function readConfig(env) {
  const webhookSecret = env.REVENUECAT_WEBHOOK_SECRET;
  const apiKey = env.REVENUECAT_SECRET_KEY;
  return webhookSecret && apiKey ? { webhookSecret, apiKey } : null;
}

/** Los uuid a refrescar: el `app_user_id` y, en un TRANSFER, las cuentas de origen y destino. */
export function targetUserIds(event) {
  const ids = [event.app_user_id];
  if (event.type === 'TRANSFER') {
    for (const list of [event.transferred_from, event.transferred_to]) {
      if (Array.isArray(list)) ids.push(...list);
    }
  }
  return [...new Set(ids.filter(isUserId))];
}

export async function handleWebhookRequest({ authorization, body, config, deps }) {
  // Sin secretos no se puede ni autenticar: 503 para que RevenueCat reintente cuando se configure.
  if (!config) return { status: 503, body: { error: 'unconfigured' } };
  if (!(await secretMatches(authorization, config.webhookSecret))) {
    return { status: 401, body: { error: 'unauthorized' } };
  }

  const event = body && typeof body === 'object' ? body.event : null;
  if (!event || typeof event !== 'object' || typeof event.id !== 'string' || event.id === '') {
    return { status: 400, body: { error: 'event' } };
  }
  if (!RELEVANT_EVENTS.has(event.type)) {
    return { status: 200, body: { ok: true, ignored: 'type' } };
  }

  const targets = targetUserIds(event);
  if (targets.length === 0) return { status: 200, body: { ok: true, ignored: 'user' } };

  try {
    if (await deps.hasSeenEvent(event.id)) {
      return { status: 200, body: { ok: true, ignored: 'duplicate' } };
    }
    let updated = 0;
    for (const userId of targets) {
      if (!(await deps.profileExists(userId))) continue; // cuenta borrada
      await refreshEntitlement(userId, deps);
      updated += 1;
    }
    await deps.markEventSeen(event.id);
    return { status: 200, body: { ok: true, updated } };
  } catch (error) {
    deps.log?.(
      `evento ${event.id} (${event.type}) fallido: ${error instanceof Error ? error.message : String(error)}`
    );
    return { status: 502, body: { error: 'upstream' } };
  }
}
