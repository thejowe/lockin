/**
 * Cancela los avisos Lock-In que una instalación anterior dejó programados.
 *
 * Desde el 2026-10-12 la app es solo cofundador: las sesiones y salas ya no se
 * ven y sus sincronizadores no se montan. Pero los avisos que ya estaban
 * registrados en el sistema seguirían saltando y mandarían a pantallas que no
 * existen. Reconciliar contra una lista vacía es exactamente «cancela todo lo
 * apuntado»: reutiliza `syncReminders` y `syncRoomReminders` sin tocarlos, y es
 * idempotente — sin nada apuntado no hace nada. Sin interfaz.
 *
 * Vive en `salas` porque es el bloque que ya depende de `sesiones`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';

import { createNotificationsPort, syncReminders } from '@/features/session';

import { syncRoomReminders } from './room-reminders';

import type { NotificationsPort, ReminderStorage } from '@/features/session';

// Instancia estable y perezosa: importar salas no carga el módulo nativo.
let defaultNotifications: NotificationsPort | null | undefined;

function getDefaultNotifications(): NotificationsPort | null {
  if (defaultNotifications === undefined) defaultNotifications = createNotificationsPort();
  return defaultNotifications;
}

export function ClearLockInReminders({
  notifications = getDefaultNotifications(),
  storage = AsyncStorage,
}: {
  notifications?: NotificationsPort | null;
  storage?: ReminderStorage;
}) {
  useEffect(() => {
    const deps = { notifications, storage, nowMs: Date.now() };
    // Sin red ni permisos que pedir: cancelar no pide permiso. Si algo falla,
    // se reintenta en la próxima apertura.
    void syncReminders([], deps)
      .then(() => syncRoomReminders([], deps))
      .catch(() => {});
  }, [notifications, storage]);

  return null;
}
