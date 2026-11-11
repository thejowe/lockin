/**
 * Notificaciones push sobre `expo-notifications`.
 *
 * El módulo se carga de forma perezosa y a prueba de fallos: en web no hay push
 * de Expo, en Expo Go de Android importar el paquete lanza (ver
 * `docs/plan/todo/sesiones.md`), y en un simulador no hay token. En todos esos
 * casos lo de aquí no hace nada y la app sigue igual.
 *
 * Tres piezas:
 *
 * - `registerForPush`: pide permiso (si se le deja) y guarda el token de Expo
 *   de este dispositivo en el servidor. Sin diálogo al arrancar; el permiso se
 *   pide al ver likes, hacer match o entrar en grupo/chat.
 * - `installPushHandlers`: tocar un aviso abre su destino permitido; con ese
 *   destino en foco, el aviso se silencia (sin badge).
 * - `forgetPushToken`: al cerrar sesión, el dispositivo deja de recibir los
 *   avisos de esa cuenta.
 *
 * Si la persona retira el permiso en los ajustes del sistema, la siguiente
 * comprobación lo ve y da de baja el token que hubiera guardado
 * (`forgetPushTokenIfDenied` al arrancar y al volver a primer plano, desde
 * `PushBridge`; `registerForPush` con `remove` al entrar en un grupo): la
 * política de privacidad promete borrarlo al desactivar las notificaciones.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { t, tk } from '@/i18n';

type NotificationsModule = typeof import('expo-notifications');

export type PushPlatform = 'ios' | 'android';
export type PushRegistration = 'registered' | 'denied' | 'unavailable';

/** ID histórico del chat de grupo; se conserva para las instalaciones existentes. */
export const GROUP_CHANNEL_ID = 'group-messages';
const PUSH_TOKEN_KEY = 'lockin.push-token';

let cached: NotificationsModule | null | undefined;
let token: string | null = null;
let activeRoute: string | null = null;
let activeRevision = 0;
let prompted = false;
const CHANNELS = [
  [GROUP_CHANNEL_ID, tk('Grupos')],
  ['messages', tk('Mensajes')],
  ['matches', tk('Matches')],
  ['likes', tk('Likes')],
  ['groups', tk('Actividad de grupos')],
  ['reminders', tk('Recordatorios')],
] as const;
let pending: Promise<unknown> = Promise.resolve();

// Salir espera a cualquier registro en curso antes de dar de baja el token.
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation);
  pending = result.catch(() => undefined);
  return result;
}

function load(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  cached = null;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return cached;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return cached;
  try {
    // Debe ser síncrono y perezoso: importar el módulo en Expo Go puede lanzar.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;
  } catch {
    cached = null;
  }
  return cached;
}

/** Solo para tests: vuelve a decidir si hay módulo y olvida el estado. */
export function resetPushForTests(): void {
  cached = undefined;
  token = null;
  activeRoute = null;
  activeRevision = 0;
  prompted = false;
  pending = Promise.resolve();
}

/** El token que este dispositivo registró en esta sesión de la app, si hay. */
export function currentPushToken(): string | null {
  return token;
}

type RemoveToken = (token: string) => Promise<void>;

/**
 * Pide permiso (solo con `prompt`) y registra el token con `save`. Si el
 * permiso no está concedido y se pasa `remove`, da de baja el token que este
 * dispositivo tuviera guardado (permiso retirado en el sistema). Nunca lanza:
 * un fallo aquí no puede romper la pantalla que lo llama.
 */
export function registerForPush(
  save: (token: string, platform: PushPlatform) => Promise<void>,
  { prompt, remove }: { prompt: boolean; remove?: RemoveToken }
): Promise<PushRegistration> {
  return enqueue(() => register(save, prompt, remove));
}

async function register(
  save: (token: string, platform: PushPlatform) => Promise<void>,
  prompt: boolean,
  remove: RemoveToken | undefined
): Promise<PushRegistration> {
  const Notifications = load();
  if (!Notifications) return 'unavailable';
  try {
    if (Platform.OS === 'android') {
      // En Android 13+ el diálogo de permiso solo sale si ya existe un canal.
      for (const [id, label] of CHANNELS) {
        await Notifications.setNotificationChannelAsync(id, {
          name: t(label),
          importance:
            id === 'reminders'
              ? Notifications.AndroidImportance.DEFAULT
              : Notifications.AndroidImportance.HIGH,
        });
      }
    }
    const permission = await Notifications.getPermissionsAsync();
    let { status } = permission;
    if (status === 'undetermined' && permission.canAskAgain !== false && prompt && !prompted) {
      prompted = true;
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') {
      if (remove) await forget(remove);
      return 'denied';
    }

    // El de `app.json` (`extra.eas.projectId`); en builds de EAS también va en `easConfig`.
    const projectId = (Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId) as string | undefined;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : {});
    // Se conserva entre arranques, incluso si el RPC falla después de escribir.
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, data);
    await save(data, Platform.OS as PushPlatform);
    token = data;
    return 'registered';
  } catch (cause) {
    console.warn('[lockin] no se ha podido activar el aviso push', cause);
    return 'unavailable';
  }
}

/** El chat de grupo que se está viendo: sus avisos no se enseñan encima. */
export function setActiveGroupChat(groupId: string | null): void {
  setActivePushRoute(groupId ? `/group/${groupId}` : null);
}

/** Siempre desde el foco de navegación, nunca desde el mero montaje del chat. */
export function setActivePushRoute(route: string | null): () => void {
  const revision = ++activeRevision;
  activeRoute = route;
  // El blur de una pantalla anterior no puede borrar el foco de la siguiente.
  return () => {
    if (activeRevision === revision) activeRoute = null;
  };
}

export async function pushPermission(): Promise<
  'granted' | 'denied' | 'undetermined' | 'unavailable'
> {
  try {
    return (await load()?.getPermissionsAsync())?.status ?? 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export function routeOf(data: unknown): string | null {
  const url = (data as { url?: unknown } | null | undefined)?.url;
  if (typeof url !== 'string') return null;
  if (['/likes', '/premium', '/(tabs)/matches'].includes(url)) return url;
  return /^\/(group|chat)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url)
    ? url
    : null;
}

/**
 * Engancha cómo se enseñan los avisos y qué hace tocarlos. Devuelve cómo
 * soltarlo. `open` recibe una ruta interna ya validada (`/group/<id>`).
 */
export function installPushHandlers(open: (route: string) => void): () => void {
  const Notifications = load();
  if (!Notifications) return () => undefined;

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as {
        groupId?: unknown;
        matchId?: unknown;
      } | null;
      const groupId = data?.groupId;
      const matchId = data?.matchId;
      const route =
        routeOf(notification.request.content.data) ??
        (typeof groupId === 'string'
          ? `/group/${groupId}`
          : typeof matchId === 'string'
            ? `/chat/${matchId}`
            : null);
      const hidden = activeRoute !== null && route === activeRoute;
      return {
        shouldShowBanner: !hidden,
        shouldShowList: !hidden,
        shouldPlaySound: !hidden,
        shouldSetBadge: false,
      };
    },
  });

  const handle = (response: { notification: { request: { content: { data?: unknown } } } }) => {
    const route = routeOf(response.notification.request.content.data);
    if (route) open(route);
  };
  // Arranque en frío desde un aviso: la respuesta ya estaba ahí antes de montar.
  const last = Notifications.getLastNotificationResponse();
  if (last) {
    handle(last);
    Notifications.clearLastNotificationResponse();
  }
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  return () => {
    subscription.remove();
    Notifications.setNotificationHandler(null);
  };
}

/**
 * Al volver a primer plano: si el permiso ya no está concedido (la persona lo
 * retiró en los ajustes del sistema), da de baja el token guardado. Nunca
 * pregunta ni registra un token nuevo; sin token guardado no llama a nadie.
 */
export function forgetPushTokenIfDenied(remove: RemoveToken): Promise<void> {
  return enqueue(async () => {
    const Notifications = load();
    if (!Notifications) return;
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') await forget(remove);
    } catch (cause) {
      console.warn('[lockin] no se ha podido comprobar el permiso de avisos', cause);
    }
  });
}

/** Al cerrar sesión. Mejor esfuerzo: un fallo no impide salir. */
export function forgetPushToken(remove: RemoveToken): Promise<void> {
  return enqueue(() => forget(remove));
}

// Fuera de la cola: la llaman `forgetPushToken` y `register`, que ya van en ella.
async function forget(remove: RemoveToken): Promise<void> {
  try {
    const current = token ?? (await AsyncStorage.getItem(PUSH_TOKEN_KEY));
    token = null;
    if (!current) return;
    await remove(current);
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  } catch (cause) {
    // Si falla la baja, se conserva en el almacenamiento para reintentar.
    console.warn('[lockin] no se ha podido olvidar el token push', cause);
  }
}
