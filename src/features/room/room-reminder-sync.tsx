/** Reconcilia al abrir los tabs y con cada cambio de salas. Sin interfaz. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';

import { useRepositories } from '@/data';
import { createNotificationsPort } from '@/features/session';

import { syncRoomReminders } from './room-reminders';

import type { NotificationsPort, ReminderStorage } from '@/features/session';

// Instancia estable y perezosa: importar salas no carga el módulo nativo.
let defaultNotifications: NotificationsPort | null | undefined;

function getDefaultNotifications(): NotificationsPort | null {
  if (defaultNotifications === undefined) defaultNotifications = createNotificationsPort();
  return defaultNotifications;
}

export function RoomReminderSync({
  notifications = getDefaultNotifications(),
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

    const sync = async () => {
      if (cancelled) return;
      if (running) {
        pending = true;
        return;
      }
      running = true;
      try {
        const rooms = await repositories.rooms.listLive();
        if (cancelled) return;
        await syncRoomReminders(rooms, { notifications, storage, nowMs: Date.now() });
      } catch {
        // Conserva los avisos si falla la lectura; reintenta con el siguiente cambio.
      } finally {
        running = false;
        if (pending && !cancelled) {
          pending = false;
          void sync();
        }
      }
    };

    const unsubscribe = repositories.rooms.subscribe(() => void sync());
    void sync();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [repositories, notifications, storage]);

  return null;
}
