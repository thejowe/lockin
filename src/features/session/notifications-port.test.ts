/** El puerto sobre `expo-notifications`, contra el doble de `jest.setup.js`. */

import * as Notifications from 'expo-notifications';

import { createNotificationsPort } from './notifications-port';
import { SESSIONS_CHANNEL_ID } from './reminders';

const mocked = Notifications as jest.Mocked<typeof Notifications>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createNotificationsPort', () => {
  it('con permiso ya concedido no vuelve a pedirlo', async () => {
    const port = createNotificationsPort()!;

    await expect(port.ensurePermission()).resolves.toBe(true);
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('si no se puede volver a preguntar, lo da por denegado sin pedir', async () => {
    mocked.getPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      canAskAgain: false,
    } as never);
    const port = createNotificationsPort()!;

    await expect(port.ensurePermission()).resolves.toBe(false);
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('programa con trigger de fecha en el canal de sesiones y cancela por id', async () => {
    const port = createNotificationsPort()!;
    const at = new Date('2026-09-14T17:55:00.000Z');

    await expect(port.schedule(at, 'Título', 'Cuerpo')).resolves.toBe('notification-id');
    await port.cancel('notification-id');

    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { title: 'Título', body: 'Cuerpo' },
      trigger: { type: 'date', date: at, channelId: SESSIONS_CHANNEL_ID },
    });
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notification-id');
  });
});
