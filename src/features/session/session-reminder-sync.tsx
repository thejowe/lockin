/**
 * Reconcilia los avisos locales con las sesiones reales. Sin interfaz.
 *
 * Va montado en el layout de tabs para correr al abrir la app: así quien propuso
 * programa su aviso aunque la aceptación llegara con la app cerrada. Repite en
 * cada cambio de matches o de sesiones de cualquier match.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';

import { useRepositories } from '@/data';

import { createNotificationsPort } from './notifications-port';
import { setReminderPermissionDenied } from './reminder-permission';
import { syncReminders } from './reminders';

import type { NotificationsPort, ReminderStorage, ReminderTarget } from './reminders';
import type { Unsubscribe } from '@/data';

/** Una sola instancia por proceso: un objeto nuevo por render relanzaría el efecto. */
const defaultNotifications = createNotificationsPort();

export function SessionReminderSync({
  notifications = defaultNotifications,
  storage = AsyncStorage,
}: {
  notifications?: NotificationsPort | null;
  storage?: ReminderStorage;
}) {
  const repositories = useRepositories();

  useEffect(() => {
    let cancelled = false;
    let running = false;
    let pending = false;
    const watched = new Map<string, Unsubscribe>();

    const sync = async () => {
      if (running) {
        pending = true;
        return;
      }
      running = true;
      try {
        const matches = await repositories.matches.list();
        for (const match of matches) {
          if (!watched.has(match.id)) {
            watched.set(
              match.id,
              repositories.sessions.subscribe(match.id, () => void sync())
            );
          }
        }
        const targets: ReminderTarget[] = [];
        for (const match of matches) {
          const session = await repositories.sessions.getActive(match.id);
          if (session)
            targets.push({ session, counterpartName: match.counterpart.name.split(' ')[0] });
        }
        if (cancelled) return;
        const result = await syncReminders(targets, { notifications, storage, nowMs: Date.now() });
        if (result.permissionDenied) setReminderPermissionDenied(true);
      } catch {
        // Sin red o sin sesión: se reintenta con el siguiente cambio.
      } finally {
        running = false;
        if (pending && !cancelled) {
          pending = false;
          void sync();
        }
      }
    };

    void sync();
    const unsubscribeMatches = repositories.matches.subscribe(() => void sync());

    return () => {
      cancelled = true;
      unsubscribeMatches();
      watched.forEach((unsubscribe) => unsubscribe());
    };
  }, [repositories, notifications, storage]);

  return null;
}
