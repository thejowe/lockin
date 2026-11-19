/**
 * Avisos push del servicio. Sin Deno ni red: todo lo de fuera
 * entra por `deps`.
 *
 * - Autenticación: la cabecera `x-push-secret` debe ser el secreto compartido
 *   con el trigger de Postgres (Vault `push_webhook_secret` = secreto de la
 *   función `PUSH_WEBHOOK_SECRET`), comparado en tiempo constante.
 * - El cuerpo identifica el evento o la tarea: destinatarios, nombres y texto
 *   salen de RPC service_role, con preferencias, bloqueos y límites en SQL.
 * - Se manda a la API de Expo en lotes de 100. Los tokens que Expo da por
 *   muertos (`DeviceNotRegistered`) se borran.
 *
 * `deps`:
 * - `targets(eventId, type)` → filas de destinatarios del RPC correspondiente.
 * - `sendToExpo(messages)` → `{ status, body }` de `POST /--/api/v2/push/send`.
 * - `forgetTokens(tokens)`.
 * - `completeNotices(ids)` → marcas de tareas programadas con ticket aceptado.
 * - `log(...args)`.
 */

import { secretMatches } from '../revenuecat-webhook/logic.mjs';
import { notificationCopy } from './copy.mjs';

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
export function buildMessages(rows, type = 'group-message') {
  if (type === 'project-event' || type === 'project-reminders') {
    return rows.map((row) => {
      const reminder = row.event_kind === 'task' || row.event_kind === 'meeting';
      return {
        to: row.token,
        ...notificationCopy(row, type),
        channelId: reminder ? 'reminders' : 'messages',
        ...(reminder ? {} : { sound: 'default' }),
        threadId: `match:${row.match_id}`,
        collapseId: `project:${row.source_id}`,
        data: { url: `/chat/${row.match_id}`, matchId: row.match_id },
      };
    });
  }
  if (type !== 'group-message')
    return rows.map((row) => {
      const direct = type === 'direct-message';
      const chat = direct || type === 'match';
      const likes = type === 'like-digest' || (type === 'reengagement' && row.like_count > 0);
      const reminder = type === 'reengagement' || type === 'premium-expiry';
      const thread = chat
        ? `match:${row.match_id}`
        : likes
          ? `likes:${row.user_id}`
          : type === 'group-activity'
            ? row.event_kind === 'group-like'
              ? `group-likes:${row.group_id}`
              : `group:${row.group_id}`
            : `${type}:${row.user_id}`;
      return {
        to: row.token,
        ...(direct
          ? { title: row.sender_name, body: preview(row.body) }
          : notificationCopy(row, type)),
        ...(!reminder ? { sound: 'default' } : {}),
        channelId: reminder
          ? 'reminders'
          : chat
            ? direct
              ? 'messages'
              : 'matches'
            : likes
              ? 'likes'
              : 'groups',
        threadId: thread,
        collapseId: thread,
        data: {
          url: chat
            ? `/chat/${row.match_id}`
            : likes
              ? '/likes'
              : type === 'premium-expiry'
                ? '/premium'
                : row.url,
          ...(chat ? { matchId: row.match_id } : {}),
        },
      };
    });
  return rows.map((row) => ({
    to: row.token,
    title: row.group_name,
    body: row.sender_name ? `${row.sender_name}: ${preview(row.body)}` : preview(row.body),
    sound: 'default',
    channelId: 'group-messages',
    // Mismo hilo en iOS y misma «conversación» en Android: no se apilan sueltas.
    threadId: `group:${row.group_id}`,
    collapseId: `group:${row.group_id}`,
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
  const allowedTypes = [
    'group-message',
    'direct-message',
    'match',
    'group-activity',
    'like-digest',
    'reengagement',
    'premium-expiry',
    'project-event',
    'project-reminders',
  ];
  if (body && Object.hasOwn(body, 'type') && !allowedTypes.includes(body.type))
    return { status: 400, body: { error: 'type' } };
  const type = body?.type ?? 'group-message';
  const idKey = {
    'group-message': 'message_id',
    'direct-message': 'message_id',
    match: 'match_id',
    'group-activity': 'event_id',
    'project-event': 'event_id',
  }[type];
  const scheduled = ['like-digest', 'reengagement', 'premium-expiry', 'project-reminders'].includes(
    type
  );
  if ((!idKey && !scheduled) || !body || Array.isArray(body) || typeof body !== 'object') {
    return { status: 400, body: { error: 'type' } };
  }
  if (idKey && (typeof body[idKey] !== 'string' || !UUID.test(body[idKey])))
    return { status: 400, body: { error: idKey } };
  if (Object.keys(body).some((key) => key !== 'type' && key !== idKey))
    return { status: 400, body: { error: 'body' } };

  const rows = await deps.targets(idKey ? body[idKey] : null, type);
  const messages = buildMessages(rows, type);
  let sent = 0;
  const dead = [];
  const completed = new Set();
  for (let start = 0; start < messages.length; start += BATCH_SIZE) {
    const batch = messages.slice(start, start + BATCH_SIZE);
    let response;
    try {
      response = await deps.sendToExpo(batch);
    } catch {
      deps.log('expo push network failure');
      continue;
    }
    if (response.status >= 400) {
      deps.log('expo push', response.status); // Nunca registrar tokens, nombres ni mensajes.
      continue;
    }
    const tickets = Array.isArray(response.body?.data) ? response.body.data : [];
    tickets.forEach((ticket, index) => {
      if (ticket?.status === 'ok' && batch[index]) {
        sent++;
        const notice = rows[start + index]?.notice_id;
        if (notice) completed.add(notice);
      }
    });
    dead.push(...deadTokens(batch, response.body));
  }
  if (completed.size > 0) await deps.completeNotices([...completed], type);
  if (dead.length > 0) await deps.forgetTokens(dead);
  return { status: 200, body: { sent, forgotten: dead.length } };
}
