/**
 * Aviso push de un mensaje del chat de grupo. Sin Deno ni red: todo lo de fuera
 * entra por `deps`.
 *
 * - Autenticación: la cabecera `x-push-secret` debe ser el secreto compartido
 *   con el trigger de Postgres (Vault `push_webhook_secret` = secreto de la
 *   función `PUSH_WEBHOOK_SECRET`), comparado en tiempo constante.
 * - El cuerpo solo dice QUÉ mensaje: destinatarios, nombres y texto salen de
 *   `group_message_push_targets`, que ya excluye a quien lo envía y los bloqueos.
 * - Se manda a la API de Expo en lotes de 100. Los tokens que Expo da por
 *   muertos (`DeviceNotRegistered`) se borran.
 *
 * `deps`:
 * - `targets(messageId)` → filas `{ token, group_id, group_name, sender_name, body }`.
 * - `sendToExpo(messages)` → `{ status, body }` de `POST /--/api/v2/push/send`.
 * - `forgetTokens(tokens)`.
 * - `log(...args)`.
 */

import { secretMatches } from '../revenuecat-webhook/logic.mjs';

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const BATCH_SIZE = 100;
/** Lo que se ve del mensaje en la notificación. */
export const PREVIEW_LENGTH = 140;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readConfig(env) {
  const secret = env.PUSH_WEBHOOK_SECRET;
  return typeof secret === 'string' && secret !== '' ? { secret } : null;
}

export function preview(body) {
  const text = String(body ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = Array.from(text);
  return chars.length > PREVIEW_LENGTH ? `${chars.slice(0, PREVIEW_LENGTH - 1).join('')}…` : text;
}

/** Un mensaje de Expo por token. Abrirlo lleva al chat del grupo. */
export function buildMessages(rows) {
  return rows.map((row) => ({
    to: row.token,
    title: row.group_name,
    body: row.sender_name ? `${row.sender_name}: ${preview(row.body)}` : preview(row.body),
    sound: 'default',
    channelId: 'group-messages',
    // Mismo hilo en iOS y misma «conversación» en Android: no se apilan sueltas.
    threadId: `group:${row.group_id}`,
    data: { url: `/group/${row.group_id}`, groupId: row.group_id },
  }));
}

/** Tokens que Expo rechaza para siempre, leídos de la respuesta de un lote. */
export function deadTokens(messages, response) {
  const tickets = Array.isArray(response?.data) ? response.data : [];
  return tickets.flatMap((ticket, index) =>
    ticket?.status === 'error' &&
    ticket?.details?.error === 'DeviceNotRegistered' &&
    messages[index]
      ? [messages[index].to]
      : []
  );
}

export async function handlePushRequest({ secretHeader, body, config, deps }) {
  if (!config) return { status: 503, body: { error: 'config' } };
  if (!(await secretMatches(secretHeader, config.secret))) {
    return { status: 401, body: { error: 'secret' } };
  }
  const messageId = body?.message_id;
  if (typeof messageId !== 'string' || !UUID.test(messageId)) {
    return { status: 400, body: { error: 'message_id' } };
  }

  const rows = await deps.targets(messageId);
  const messages = buildMessages(rows);
  let sent = 0;
  const dead = [];
  for (let start = 0; start < messages.length; start += BATCH_SIZE) {
    const batch = messages.slice(start, start + BATCH_SIZE);
    const response = await deps.sendToExpo(batch);
    if (response.status >= 400) {
      deps.log('expo push', response.status, response.body);
      continue;
    }
    sent += batch.length;
    dead.push(...deadTokens(batch, response.body));
  }
  if (dead.length > 0) await deps.forgetTokens(dead);
  return { status: 200, body: { sent, forgotten: dead.length } };
}
