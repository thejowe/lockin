/**
 * Al ocultar Lock-In (2026-10-12), los avisos que ya estaban programados no
 * pueden seguir saltando: se cancelan los de sesiones y los de salas, y solo
 * esos — el resto del almacenamiento no se toca.
 *
 * Ojo: en RNTL 14 `render` es asíncrono.
 */

import { render, waitFor } from '@testing-library/react-native';

import { ClearLockInReminders } from './clear-lockin-reminders';

import type { NotificationsPort, ReminderStorage } from '@/features/session';

function memoryStorage(initial: Record<string, string>): ReminderStorage & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
    getAllKeys: async () => [...data.keys()],
  };
}

function fakeNotifications(): NotificationsPort & { cancelled: string[] } {
  const cancelled: string[] = [];
  return {
    cancelled,
    ensurePermission: jest.fn(async () => true),
    schedule: jest.fn(async () => 'nuevo'),
    cancel: async (id) => void cancelled.push(id),
  };
}

describe('ClearLockInReminders', () => {
  it('cancela los avisos de sesiones y de salas ya programados', async () => {
    const storage = memoryStorage({
      'lockin:reminder:s1': 'aviso-sesion',
      'lockin:room-reminder:r1': 'aviso-sala',
      'otra:clave': 'intacta',
    });
    const notifications = fakeNotifications();

    await render(<ClearLockInReminders notifications={notifications} storage={storage} />);

    await waitFor(() =>
      expect(notifications.cancelled.sort()).toEqual(['aviso-sala', 'aviso-sesion'])
    );
    await waitFor(() => expect([...storage.data.keys()]).toEqual(['otra:clave']));
    expect(notifications.schedule).not.toHaveBeenCalled();
    expect(notifications.ensurePermission).not.toHaveBeenCalled();
  });

  it('si el almacenamiento falla no rompe la app: se reintenta al volver a abrir', async () => {
    const storage = memoryStorage({});
    const getAllKeys = jest.spyOn(storage, 'getAllKeys').mockRejectedValue(new Error('disco'));
    const notifications = fakeNotifications();

    await render(<ClearLockInReminders notifications={notifications} storage={storage} />);

    await waitFor(() => expect(getAllKeys).toHaveBeenCalled());
    expect(notifications.cancelled).toEqual([]);
  });

  it('sin módulo de avisos (web) no hace nada', async () => {
    const storage = memoryStorage({ 'lockin:reminder:s1': 'aviso-sesion' });

    await render(<ClearLockInReminders notifications={null} storage={storage} />);

    expect([...storage.data.keys()]).toEqual(['lockin:reminder:s1']);
  });
});
