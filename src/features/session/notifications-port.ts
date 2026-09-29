/**
 * Puerto de notificaciones sobre `expo-notifications`.
 *
 * `null` en web: la documentación de SDK 57 solo lista Android e iOS, así que
 * el módulo ni se carga. En Android el canal se crea antes de pedir permiso: en
 * Android 13+ el diálogo no aparece sin un canal.
 *
 * `null` también en Expo Go Android: desde SDK 53 Expo Go no trae el módulo y
 * su `require` lanza («Android Push notifications … was removed from Expo Go»).
 * Como la superficie de sesiones se importa desde el layout de tabs, ese error
 * tumbaba el arranque entero. Aquí se comprueba antes y, por si otra build
 * tampoco lo trae, el `require` va dentro de un `try` — mismo criterio que
 * `loadWebRTC()` en `webrtc.ts`. Sin puerto, los recordatorios locales quedan
 * desactivados y el resto de la sesión funciona igual. En iOS Expo Go los
 * avisos locales siguen disponibles y en las builds nativas nada cambia.
 */

import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

import { SESSIONS_CHANNEL_ID } from './reminders';

import type { NotificationsPort } from './reminders';

export function createNotificationsPort(): NotificationsPort | null {
  if (Platform.OS === 'web') return null;

  if (Platform.OS === 'android' && isRunningInExpoGo()) return null;

  let Notifications: typeof import('expo-notifications');
  try {
    // `require` y no `import`: en web el módulo no debe entrar en el bundle.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications') as typeof import('expo-notifications');
  } catch {
    return null;
  }

  return {
    async ensurePermission() {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(SESSIONS_CHANNEL_ID, {
          name: 'Sesiones Lock-In',
          importance: Notifications.AndroidImportance.HIGH,
        });
      }
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return true;
      if (!current.canAskAgain) return false;
      return (await Notifications.requestPermissionsAsync()).granted;
    },

    schedule(at, title, body) {
      return Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: at,
          channelId: SESSIONS_CHANNEL_ID,
        },
      });
    },

    cancel(notificationId) {
      return Notifications.cancelScheduledNotificationAsync(notificationId);
    },
  };
}
