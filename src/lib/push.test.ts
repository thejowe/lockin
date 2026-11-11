/**
 * El puerto de push sobre `expo-notifications` (mockeado en `jest.setup.js`):
 * cuándo pide permiso, qué registra, qué abre un aviso y qué olvida al salir.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  currentPushToken,
  forgetPushToken,
  forgetPushTokenIfDenied,
  GROUP_CHANNEL_ID,
  installPushHandlers,
  registerForPush,
  resetPushForTests,
  setActiveGroupChat,
} from './push';

jest.mock('expo-constants', () => ({
  __esModule: true,
  ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
  default: {
    executionEnvironment: 'standalone',
    expoConfig: { extra: { eas: { projectId: 'proyecto-eas' } } },
  },
}));

const mocked = Notifications as jest.Mocked<typeof Notifications>;
const GROUP = '6eab25bc-8198-41cc-8699-11a8e14e1f22';

const response = (data: unknown) =>
  ({
    notification: { request: { content: { data } } },
  }) as unknown as Notifications.NotificationResponse;

function setOS(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  resetPushForTests();
  setOS('ios');
});

afterAll(() => setOS('ios'));

describe('registerForPush', () => {
  it('sin permiso y sin poder preguntar, no registra nada', async () => {
    const save = jest.fn();
    expect(await registerForPush(save, { prompt: false })).toBe('denied');
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(currentPushToken()).toBeNull();
  });

  it('pregunta si se le deja; con el sí, guarda el token de Expo de este proyecto', async () => {
    mocked.requestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' } as never);
    const save = jest.fn(() => Promise.resolve());

    expect(await registerForPush(save, { prompt: true })).toBe('registered');
    expect(save).toHaveBeenCalledWith('ExponentPushToken[test]', 'ios');
    expect(mocked.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'proyecto-eas' });
    expect(currentPushToken()).toBe('ExponentPushToken[test]');
    // En iOS no hay canales.
    expect(mocked.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it('en Android crea antes el canal de grupos', async () => {
    setOS('android');
    mocked.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' } as never);
    const save = jest.fn(() => Promise.resolve());

    expect(await registerForPush(save, { prompt: false })).toBe('registered');
    expect(mocked.setNotificationChannelAsync).toHaveBeenCalledWith(
      GROUP_CHANNEL_ID,
      expect.objectContaining({ name: 'Grupos' })
    );
    expect(save).toHaveBeenCalledWith('ExponentPushToken[test]', 'android');
  });

  it('un fallo (sin red, simulador) no lanza ni deja token', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocked.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' } as never);
    const save = jest.fn(() => Promise.reject(new Error('sin red')));

    expect(await registerForPush(save, { prompt: false })).toBe('unavailable');
    expect(currentPushToken()).toBeNull();
    warn.mockRestore();
  });

  it('en web no hay push de Expo', async () => {
    setOS('web');
    const save = jest.fn();
    expect(await registerForPush(save, { prompt: true })).toBe('unavailable');
    expect(mocked.getPermissionsAsync).not.toHaveBeenCalled();
    expect(installPushHandlers(jest.fn())).toEqual(expect.any(Function));
    expect(mocked.setNotificationHandler).not.toHaveBeenCalled();
  });
});

describe('installPushHandlers', () => {
  it('tocar un aviso abre su chat; datos raros no navegan', () => {
    const open = jest.fn();
    const remove = jest.fn();
    mocked.addNotificationResponseReceivedListener.mockReturnValueOnce({ remove } as never);
    const uninstall = installPushHandlers(open);

    const listener = mocked.addNotificationResponseReceivedListener.mock.calls[0][0];
    listener(response({ url: `/group/${GROUP}` }));
    listener(response({ url: 'https://malo.example' }));
    listener(response(undefined));
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(`/group/${GROUP}`);

    uninstall();
    expect(remove).toHaveBeenCalled();
    expect(mocked.setNotificationHandler).toHaveBeenLastCalledWith(null);
  });

  it('si la app arrancó desde un aviso, lo abre una vez y lo olvida', () => {
    mocked.getLastNotificationResponse.mockReturnValueOnce(response({ url: `/group/${GROUP}` }));
    const open = jest.fn();
    installPushHandlers(open);
    expect(open).toHaveBeenCalledWith(`/group/${GROUP}`);
    expect(mocked.clearLastNotificationResponse).toHaveBeenCalled();
  });

  it('con el chat de ese grupo abierto, su aviso no se enseña', async () => {
    installPushHandlers(jest.fn());
    const { handleNotification } = mocked.setNotificationHandler.mock.calls[0][0]!;
    const notification = (groupId: string) =>
      ({ request: { content: { data: { groupId } } } }) as unknown as Notifications.Notification;

    setActiveGroupChat(GROUP);
    expect(await handleNotification(notification(GROUP))).toMatchObject({
      shouldShowBanner: false,
      shouldPlaySound: false,
    });
    expect(await handleNotification(notification('otro'))).toMatchObject({
      shouldShowBanner: true,
      shouldShowList: true,
    });
    setActiveGroupChat(null);
    expect(await handleNotification(notification(GROUP))).toMatchObject({
      shouldShowBanner: true,
    });
  });
});

describe('permiso retirado en el sistema', () => {
  it('la siguiente comprobación da de baja el token guardado y no vuelve a preguntar', async () => {
    mocked.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' } as never);
    await registerForPush(() => Promise.resolve(), { prompt: true });
    expect(await AsyncStorage.getItem('lockin.push-token')).toBe('ExponentPushToken[test]');

    // La persona desactiva las notificaciones en los ajustes del sistema.
    mocked.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' } as never);
    const save = jest.fn();
    const remove = jest.fn(() => Promise.resolve());
    expect(await registerForPush(save, { prompt: false, remove })).toBe('denied');

    expect(remove).toHaveBeenCalledWith('ExponentPushToken[test]');
    expect(save).not.toHaveBeenCalled();
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(currentPushToken()).toBeNull();
    expect(await AsyncStorage.getItem('lockin.push-token')).toBeNull();
  });

  it('también tras reiniciar la app (token solo en el almacenamiento)', async () => {
    mocked.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' } as never);
    await registerForPush(() => Promise.resolve(), { prompt: false });
    resetPushForTests();

    const remove = jest.fn(() => Promise.resolve());
    expect(await registerForPush(jest.fn(), { prompt: false, remove })).toBe('denied');
    expect(remove).toHaveBeenCalledWith('ExponentPushToken[test]');
  });

  it('al volver a primer plano sin permiso, da de baja sin preguntar ni registrar', async () => {
    mocked.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' } as never);
    await registerForPush(() => Promise.resolve(), { prompt: false });

    const remove = jest.fn(() => Promise.resolve());
    await forgetPushTokenIfDenied(remove);
    expect(remove).toHaveBeenCalledWith('ExponentPushToken[test]');
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('lockin.push-token')).toBeNull();
  });

  it('al volver a primer plano con permiso, no toca el token', async () => {
    mocked.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' } as never);
    await registerForPush(() => Promise.resolve(), { prompt: false });

    mocked.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' } as never);
    const remove = jest.fn(() => Promise.resolve());
    await forgetPushTokenIfDenied(remove);
    expect(remove).not.toHaveBeenCalled();
    expect(currentPushToken()).toBe('ExponentPushToken[test]');
    expect(mocked.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
  });

  it('sin token guardado no llama al servidor', async () => {
    const remove = jest.fn(() => Promise.resolve());
    expect(await registerForPush(jest.fn(), { prompt: false, remove })).toBe('denied');
    expect(remove).not.toHaveBeenCalled();
  });

  it('si la baja falla, conserva el token para reintentar en la próxima comprobación', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocked.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' } as never);
    await registerForPush(() => Promise.resolve(), { prompt: false });

    const failing = jest.fn(() => Promise.reject(new Error('sin red')));
    expect(await registerForPush(jest.fn(), { prompt: false, remove: failing })).toBe('denied');
    const retry = jest.fn(() => Promise.resolve());
    expect(await registerForPush(jest.fn(), { prompt: false, remove: retry })).toBe('denied');
    expect(retry).toHaveBeenCalledWith('ExponentPushToken[test]');
    warn.mockRestore();
  });
});

describe('forgetPushToken', () => {
  it('tras reiniciar la app también da de baja el token guardado', async () => {
    mocked.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' } as never);
    await registerForPush(() => Promise.resolve(), { prompt: false });
    resetPushForTests();
    const remove = jest.fn(() => Promise.resolve());

    await forgetPushToken(remove);
    await forgetPushToken(remove);

    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith('ExponentPushToken[test]');
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('espera al registro en curso antes de darlo de baja', async () => {
    mocked.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' } as never);
    const order: string[] = [];
    let finish!: () => void;
    const saved = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const registration = registerForPush(
      async () => {
        await saved;
        order.push('registro');
      },
      { prompt: false }
    );
    const removal = forgetPushToken(async () => {
      order.push('baja');
    });
    finish();
    await Promise.all([registration, removal]);
    expect(order).toEqual(['registro', 'baja']);
    expect(currentPushToken()).toBeNull();
  });

  it('borra el token registrado una sola vez, y sin token no llama', async () => {
    mocked.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' } as never);
    await registerForPush(() => Promise.resolve(), { prompt: false });
    const remove = jest.fn(() => Promise.resolve());

    await forgetPushToken(remove);
    await forgetPushToken(remove);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith('ExponentPushToken[test]');
    expect(currentPushToken()).toBeNull();
  });

  it('un fallo al olvidar no impide cerrar sesión', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocked.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' } as never);
    await registerForPush(() => Promise.resolve(), { prompt: false });
    await expect(forgetPushToken(() => Promise.reject(new Error('x')))).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
