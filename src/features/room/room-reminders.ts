/** Avisos locales de salas; las claves están separadas de las sesiones 1:1. */
import { isRoomLive } from '@/data';
import { REMINDER_LEAD_MS } from '@/features/session';

import type { RoomView } from '@/data';
import type { NotificationsPort, ReminderStorage } from '@/features/session';

export const ROOM_REMINDER_KEY_PREFIX = 'lockin:room-reminder:';

export interface RoomReminderSyncResult {
  scheduled: string[];
  cancelled: string[];
  permissionDenied: boolean;
}

/** Reconciliación idempotente sobre la lista completa de salas vivas. */
export async function syncRoomReminders(
  views: RoomView[],
  deps: { notifications: NotificationsPort | null; storage: ReminderStorage; nowMs: number }
): Promise<RoomReminderSyncResult> {
  const { notifications, storage, nowMs } = deps;
  const result: RoomReminderSyncResult = { scheduled: [], cancelled: [], permissionDenied: false };
  if (!notifications) return result;

  const wanted = new Map(
    views
      .filter(({ room, me }) => me.status === 'aceptada' && isRoomLive(room, nowMs))
      .map(({ room }) => [room.id, room])
  );

  const keys = (await storage.getAllKeys()).filter((key) =>
    key.startsWith(ROOM_REMINDER_KEY_PREFIX)
  );
  for (const key of keys) {
    const roomId = key.slice(ROOM_REMINDER_KEY_PREFIX.length);
    if (wanted.has(roomId)) continue;
    const notificationId = await storage.getItem(key);
    if (notificationId) await notifications.cancel(notificationId);
    await storage.removeItem(key);
    result.cancelled.push(roomId);
  }

  for (const [roomId, room] of wanted) {
    const at = Date.parse(room.startsAt) - REMINDER_LEAD_MS;
    if (at <= nowMs) continue;
    const key = `${ROOM_REMINDER_KEY_PREFIX}${roomId}`;
    if (await storage.getItem(key)) continue;
    if (!(await notifications.ensurePermission())) {
      result.permissionDenied = true;
      return result;
    }
    const notificationId = await notifications.schedule(
      new Date(at),
      'Sala Lock-In en 5 minutos',
      'Entra desde Matches.'
    );
    await storage.setItem(key, notificationId);
    result.scheduled.push(roomId);
  }

  return result;
}
