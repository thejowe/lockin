import { act, render, waitFor } from '@testing-library/react-native';

import { DataProvider } from '@/data';
import { createMockRepositories } from '@/data/mock';

import { RoomReminderSync } from './room-reminder-sync';

import type { RoomView } from '@/data';
import type { ReminderStorage } from '@/features/session';

function setup() {
  const repositories = createMockRepositories();
  const room: RoomView = {
    room: {
      id: 'r1',
      hostId: 'me',
      startsAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      blocks: 1,
      cancelledAt: null,
      createdAt: new Date().toISOString(),
    },
    me: {
      roomId: 'r1',
      profileId: 'me',
      status: 'aceptada',
      respondedAt: null,
      joinedAt: null,
      leftAt: null,
    },
    others: [],
  };
  const listLive = jest.fn().mockResolvedValue([room]);
  let notify!: () => void;
  const unsubscribe = jest.fn();
  repositories.rooms = {
    ...repositories.rooms,
    listLive,
    subscribe: (listener) => {
      notify = listener;
      return unsubscribe;
    },
  };
  const data = new Map([['lockin:room-reminder:old', 'old']]);
  const storage: ReminderStorage = {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
    getAllKeys: async () => [...data.keys()],
  };
  const notifications = {
    ensurePermission: jest.fn(async () => true),
    schedule: jest.fn(async () => 'new'),
    cancel: jest.fn(async () => undefined),
  };
  const mount = () =>
    render(
      <DataProvider value={repositories}>
        <RoomReminderSync notifications={notifications} storage={storage} />
      </DataProvider>
    );
  return { listLive, notify: () => notify(), unsubscribe, data, notifications, mount };
}

it('reconcilia al montar y al cambiar las salas; suelta la suscripción al salir', async () => {
  const deps = setup();
  const { unmount } = await deps.mount();
  await waitFor(() => expect(deps.data.get('lockin:room-reminder:r1')).toBe('new'));
  expect(deps.notifications.cancel).toHaveBeenCalledWith('old');
  deps.listLive.mockResolvedValue([]);
  await act(async () => deps.notify());
  await waitFor(() => expect(deps.data.size).toBe(0));
  expect(deps.notifications.cancel).toHaveBeenCalledWith('new');
  await unmount();
  expect(deps.unsubscribe).toHaveBeenCalledTimes(1);
});

it('conserva los avisos si falla la lectura y reintenta con el siguiente cambio', async () => {
  const deps = setup();
  deps.listLive.mockRejectedValueOnce(new Error('sin red'));
  await deps.mount();
  expect(deps.data.get('lockin:room-reminder:old')).toBe('old');
  expect(deps.notifications.cancel).not.toHaveBeenCalled();
  await act(async () => deps.notify());
  await waitFor(() => expect(deps.data.get('lockin:room-reminder:r1')).toBe('new'));
});

it('serializa cambios durante una lectura y reconcilia la lista más reciente', async () => {
  const deps = setup();
  let resolve!: (rooms: RoomView[]) => void;
  deps.listLive.mockReturnValueOnce(
    new Promise<RoomView[]>((done) => {
      resolve = done;
    })
  );
  await deps.mount();
  await act(async () => {
    deps.notify();
    deps.notify();
  });
  expect(deps.listLive).toHaveBeenCalledTimes(1);
  await act(async () => resolve([]));
  await waitFor(() => expect(deps.data.get('lockin:room-reminder:r1')).toBe('new'));
  expect(deps.listLive).toHaveBeenCalledTimes(2);
  expect(deps.notifications.schedule).toHaveBeenCalledTimes(1);
});

it('ignora lecturas y eventos tardíos después de desmontar', async () => {
  const deps = setup();
  let resolve!: (rooms: RoomView[]) => void;
  deps.listLive.mockReturnValueOnce(
    new Promise<RoomView[]>((done) => {
      resolve = done;
    })
  );
  const { unmount } = await deps.mount();
  await unmount();
  await act(async () => {
    deps.notify();
    resolve([]);
  });
  expect(deps.listLive).toHaveBeenCalledTimes(1);
  expect(deps.notifications.cancel).not.toHaveBeenCalled();
  expect(deps.notifications.schedule).not.toHaveBeenCalled();
});
