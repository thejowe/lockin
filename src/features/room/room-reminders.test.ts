import { syncReminders } from '@/features/session/reminders';

import { ROOM_REMINDER_KEY_PREFIX, syncRoomReminders } from './room-reminders';

import type { RoomView } from '@/data';
import type { NotificationsPort, ReminderStorage } from '@/features/session';

const NOW = Date.parse('2026-10-05T10:00:00Z');
const MINUTE = 60_000;

function view(status: RoomView['me']['status'] = 'aceptada'): RoomView {
  return {
    room: {
      id: 'r1',
      hostId: 'me',
      startsAt: new Date(NOW + 60 * MINUTE).toISOString(),
      blocks: 1,
      cancelledAt: null,
      createdAt: new Date(NOW).toISOString(),
    },
    me: { roomId: 'r1', profileId: 'me', status, respondedAt: null, joinedAt: null, leftAt: null },
    others: [],
  };
}

function setup(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: ReminderStorage = {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
    getAllKeys: async () => [...data.keys()],
  };
  const notifications = {
    ensurePermission: jest.fn(async (): Promise<boolean> => true),
    schedule: jest.fn(async () => 'notification'),
    cancel: jest.fn(async () => undefined),
  } satisfies NotificationsPort;
  return { data, storage, notifications, nowMs: NOW };
}

it.each(['me', 'other'])(
  'programa una aceptada, incluida quien convoca (%s), una sola vez',
  async (hostId) => {
    const deps = setup();
    const accepted = view();
    accepted.room.hostId = hostId;
    expect((await syncRoomReminders([accepted], deps)).scheduled).toEqual(['r1']);
    await syncRoomReminders([accepted], deps);
    expect(deps.notifications.schedule).toHaveBeenCalledTimes(1);
    expect(deps.notifications.schedule).toHaveBeenCalledWith(
      new Date(NOW + 55 * MINUTE),
      'Sala Lock-In en 5 minutos',
      'Entra desde Matches.'
    );
    expect(deps.data.get(`${ROOM_REMINDER_KEY_PREFIX}r1`)).toBe('notification');
  }
);

it.each([4 * MINUTE, 5 * MINUTE])(
  'no programa con %s ms de margen y conserva el aviso previo',
  async (margin) => {
    const accepted = view();
    accepted.room.startsAt = new Date(NOW + margin).toISOString();
    const deps = setup();
    await syncRoomReminders([accepted], deps);
    deps.data.set(`${ROOM_REMINDER_KEY_PREFIX}r1`, 'previous');
    await syncRoomReminders([accepted], deps);
    expect(deps.notifications.schedule).not.toHaveBeenCalled();
    expect(deps.notifications.cancel).not.toHaveBeenCalled();
    expect(deps.data.get(`${ROOM_REMINDER_KEY_PREFIX}r1`)).toBe('previous');
  }
);

it.each(['invitada', 'rechazada'] as const)(
  'no programa para una %s y retira su aviso previo',
  async (status) => {
    const deps = setup({ [`${ROOM_REMINDER_KEY_PREFIX}r1`]: 'previous' });
    expect((await syncRoomReminders([view(status)], deps)).cancelled).toEqual(['r1']);
    expect(deps.notifications.cancel).toHaveBeenCalledWith('previous');
    expect(deps.notifications.schedule).not.toHaveBeenCalled();
    expect(deps.data.size).toBe(0);
  }
);

it.each(['cancelada', 'terminada', 'ausente'])('retira el aviso de una sala %s', async (state) => {
  const deps = setup({ [`${ROOM_REMINDER_KEY_PREFIX}r1`]: 'previous' });
  const accepted = view();
  if (state === 'cancelada') accepted.room.cancelledAt = new Date(NOW).toISOString();
  if (state === 'terminada') accepted.room.startsAt = new Date(NOW - 30 * MINUTE).toISOString();
  await syncRoomReminders(state === 'ausente' ? [] : [accepted], deps);
  expect(deps.notifications.cancel).toHaveBeenCalledWith('previous');
  expect(deps.notifications.schedule).not.toHaveBeenCalled();
  expect(deps.data.size).toBe(0);
});

it('las reconciliaciones de salas y sesiones no cancelan claves de la otra', async () => {
  const deps = setup({
    'lockin:reminder:s1': 'session',
    'lockin:room-reminder:r1': 'room',
    other: 'value',
  });
  await syncRoomReminders([], deps);
  expect(deps.notifications.cancel).toHaveBeenCalledTimes(1);
  expect(deps.notifications.cancel).toHaveBeenCalledWith('room');
  expect(deps.data.get('lockin:reminder:s1')).toBe('session');
  deps.data.set('lockin:room-reminder:r1', 'room');
  deps.notifications.cancel.mockClear();
  await syncReminders([], deps);
  expect(deps.notifications.cancel).toHaveBeenCalledTimes(1);
  expect(deps.notifications.cancel).toHaveBeenCalledWith('session');
  expect(deps.data.get('lockin:room-reminder:r1')).toBe('room');
  expect(deps.data.get('other')).toBe('value');
});

it('con permiso denegado limpia avisos obsoletos pero no programa', async () => {
  const deps = setup({ [`${ROOM_REMINDER_KEY_PREFIX}old`]: 'old' });
  deps.notifications.ensurePermission.mockResolvedValue(false);
  expect((await syncRoomReminders([view()], deps)).permissionDenied).toBe(true);
  expect(deps.notifications.schedule).not.toHaveBeenCalled();
  expect(deps.notifications.cancel).toHaveBeenCalledWith('old');
  expect(deps.data.size).toBe(0);
});

it('sin puerto no toca el almacenamiento', async () => {
  const deps = setup({ [`${ROOM_REMINDER_KEY_PREFIX}old`]: 'old' });
  expect(await syncRoomReminders([view()], { ...deps, notifications: null })).toEqual({
    scheduled: [],
    cancelled: [],
    permissionDenied: false,
  });
  expect(deps.data.size).toBe(1);
});
