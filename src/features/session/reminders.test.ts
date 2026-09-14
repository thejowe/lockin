/**
 * Reconciliación de avisos locales: qué se programa, qué se cancela y qué se
 * deja como está, con un puerto de notificaciones y un almacenamiento falsos.
 */

import { REMINDER_KEY_PREFIX, REMINDER_LEAD_MS, syncReminders } from './reminders';

import type { NotificationsPort, ReminderStorage } from './reminders';
import type { LockInSession } from '@/data';

const MINUTE = 60_000;
const NOW = Date.parse('2026-09-14T10:00:00.000Z');

function memoryStorage(
  initial: Record<string, string> = {}
): ReminderStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
    getAllKeys: async () => [...data.keys()],
  };
}

function fakePort(
  granted = true
): NotificationsPort & { [K in keyof NotificationsPort]: jest.Mock } {
  return {
    ensurePermission: jest.fn(async () => granted),
    schedule: jest.fn(async () => 'nuevo-id'),
    cancel: jest.fn(async () => undefined),
  };
}

const session = (overrides: Partial<LockInSession> = {}): LockInSession => ({
  id: 's1',
  matchId: 'm1',
  proposedBy: 'nuria',
  startsAt: new Date(NOW + 60 * MINUTE).toISOString(),
  blocks: 2,
  status: 'aceptada',
  createdAt: new Date(NOW - MINUTE).toISOString(),
  respondedAt: new Date(NOW - MINUTE).toISOString(),
  ...overrides,
});

describe('syncReminders', () => {
  it('programa el aviso 5 minutos antes de una sesión aceptada y guarda su id', async () => {
    const notifications = fakePort();
    const storage = memoryStorage();

    const result = await syncReminders([{ session: session(), counterpartName: 'Núria' }], {
      notifications,
      storage,
      nowMs: NOW,
    });

    expect(notifications.schedule).toHaveBeenCalledWith(
      new Date(NOW + 60 * MINUTE - REMINDER_LEAD_MS),
      'Sesión Lock-In en 5 minutos',
      'Con Núria. Entra desde el chat.'
    );
    expect(storage.data.get(`${REMINDER_KEY_PREFIX}s1`)).toBe('nuevo-id');
    expect(result.scheduled).toEqual(['s1']);
  });

  it('no vuelve a programar lo que ya está programado', async () => {
    const notifications = fakePort();
    const storage = memoryStorage({ [`${REMINDER_KEY_PREFIX}s1`]: 'viejo-id' });

    await syncReminders([{ session: session(), counterpartName: 'Núria' }], {
      notifications,
      storage,
      nowMs: NOW,
    });

    expect(notifications.schedule).not.toHaveBeenCalled();
    expect(notifications.cancel).not.toHaveBeenCalled();
  });

  it('con menos de 5 minutos de margen no programa, pero conserva un aviso previo', async () => {
    const notifications = fakePort();
    const soon = session({ id: 's2', startsAt: new Date(NOW + 4 * MINUTE).toISOString() });
    const storage = memoryStorage({ [`${REMINDER_KEY_PREFIX}s2`]: 'previo' });

    await syncReminders([{ session: soon, counterpartName: 'Núria' }], {
      notifications,
      storage,
      nowMs: NOW,
    });
    await syncReminders([{ session: { ...soon, id: 's3' }, counterpartName: 'Núria' }], {
      notifications,
      storage: memoryStorage(),
      nowMs: NOW,
    });

    expect(notifications.schedule).not.toHaveBeenCalled();
    expect(notifications.cancel).not.toHaveBeenCalled();
  });

  it('cancela y olvida los avisos de sesiones que ya no están aceptadas y vivas', async () => {
    const notifications = fakePort();
    const storage = memoryStorage({
      [`${REMINDER_KEY_PREFIX}cancelada`]: 'id-cancelada',
      [`${REMINDER_KEY_PREFIX}s1`]: 'id-propuesta',
      'otra-clave': 'no es nuestra',
    });

    const result = await syncReminders(
      [{ session: session({ status: 'propuesta', respondedAt: null }), counterpartName: 'Núria' }],
      { notifications, storage, nowMs: NOW }
    );

    expect(notifications.cancel).toHaveBeenCalledWith('id-cancelada');
    expect(notifications.cancel).toHaveBeenCalledWith('id-propuesta');
    expect([...storage.data.keys()]).toEqual(['otra-clave']);
    expect(result.cancelled.sort()).toEqual(['cancelada', 's1']);
  });

  it('con el permiso denegado no programa y lo dice', async () => {
    const notifications = fakePort(false);
    const storage = memoryStorage();

    const result = await syncReminders([{ session: session(), counterpartName: 'Núria' }], {
      notifications,
      storage,
      nowMs: NOW,
    });

    expect(result.permissionDenied).toBe(true);
    expect(notifications.schedule).not.toHaveBeenCalled();
    expect(storage.data.size).toBe(0);
  });

  it('sin puerto de notificaciones (web) no hace nada', async () => {
    const storage = memoryStorage({ [`${REMINDER_KEY_PREFIX}x`]: 'id' });

    const result = await syncReminders([{ session: session(), counterpartName: 'Núria' }], {
      notifications: null,
      storage,
      nowMs: NOW,
    });

    expect(result).toEqual({ scheduled: [], cancelled: [], permissionDenied: false });
    expect(storage.data.size).toBe(1);
  });
});
