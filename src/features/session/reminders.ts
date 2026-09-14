/**
 * Avisos locales 5 minutos antes de una sesión aceptada.
 *
 * Reconciliación pura sobre dos puertos: el de notificaciones (nulo en web) y un
 * almacenamiento clave-valor donde se apunta qué aviso corresponde a qué sesión.
 * Idempotente: se puede llamar en cada cambio sin duplicar avisos.
 */

import { isSessionLive } from '@/data';

import type { LockInSession } from '@/data';

export const REMINDER_KEY_PREFIX = 'lockin:reminder:';
export const REMINDER_LEAD_MS = 5 * 60_000;
export const SESSIONS_CHANNEL_ID = 'lockin-sessions';

export interface NotificationsPort {
  /** Crea el canal si hace falta y pide permiso. `true` si se puede avisar. */
  ensurePermission(): Promise<boolean>;
  schedule(at: Date, title: string, body: string): Promise<string>;
  cancel(notificationId: string): Promise<void>;
}

export interface ReminderStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
}

export interface ReminderTarget {
  session: LockInSession;
  /** Nombre de pila de la otra persona, para el texto del aviso. */
  counterpartName: string;
}

export interface ReminderSyncResult {
  scheduled: string[];
  cancelled: string[];
  permissionDenied: boolean;
}

export async function syncReminders(
  targets: ReminderTarget[],
  deps: { notifications: NotificationsPort | null; storage: ReminderStorage; nowMs: number }
): Promise<ReminderSyncResult> {
  const { notifications, storage, nowMs } = deps;
  const result: ReminderSyncResult = { scheduled: [], cancelled: [], permissionDenied: false };
  if (!notifications) return result;

  const wanted = new Map(
    targets
      .filter(({ session }) => session.status === 'aceptada' && isSessionLive(session, nowMs))
      .map((target) => [target.session.id, target])
  );

  const keys = (await storage.getAllKeys()).filter((key) => key.startsWith(REMINDER_KEY_PREFIX));
  for (const key of keys) {
    const sessionId = key.slice(REMINDER_KEY_PREFIX.length);
    if (wanted.has(sessionId)) continue;
    const notificationId = await storage.getItem(key);
    if (notificationId) await notifications.cancel(notificationId);
    await storage.removeItem(key);
    result.cancelled.push(sessionId);
  }

  for (const [sessionId, { session, counterpartName }] of wanted) {
    const at = Date.parse(session.startsAt) - REMINDER_LEAD_MS;
    if (at <= nowMs) continue;
    const key = `${REMINDER_KEY_PREFIX}${sessionId}`;
    if (await storage.getItem(key)) continue;
    if (!(await notifications.ensurePermission())) {
      result.permissionDenied = true;
      return result;
    }
    const notificationId = await notifications.schedule(
      new Date(at),
      'Sesión Lock-In en 5 minutos',
      `Con ${counterpartName}. Entra desde el chat.`
    );
    await storage.setItem(key, notificationId);
    result.scheduled.push(sessionId);
  }

  return result;
}
