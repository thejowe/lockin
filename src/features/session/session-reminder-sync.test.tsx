/** `SessionReminderSync` contra el mock real: lee los matches y reconcilia al montar. */

import { render, waitFor } from '@testing-library/react-native';

import { DataProvider } from '@/data';
import { createMockRepositories, createMockSessionRepository, resetState } from '@/data/mock';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';
import { buildProfileInput } from '@/data/test-fixtures';

import { REMINDER_KEY_PREFIX } from './reminders';
import { SessionReminderSync } from './session-reminder-sync';

import type { NotificationsPort, ReminderStorage } from './reminders';

const [NURIA, , ALBA] = SEED_RECIPROCAL_IDS;
const MINUTE = 60_000;

it('programa la sesión aceptada y cancela el aviso de una que ya no está', async () => {
  resetState();
  const repositories = createMockRepositories();
  await repositories.profiles.saveCurrent(buildProfileInput());
  const { match: withNuria } = await repositories.discovery.recordDecision(NURIA, 'like');
  await repositories.discovery.recordDecision(ALBA, 'like');
  const startsAt = new Date(Date.now() + 60 * MINUTE).toISOString();
  const session = await repositories.sessions.propose({
    matchId: withNuria!.id,
    startsAt,
    blocks: 1,
  });
  await createMockSessionRepository(NURIA).respond(session.id, 'aceptada');

  const data = new Map([[`${REMINDER_KEY_PREFIX}sesion-antigua`, 'id-antiguo']]);
  const storage: ReminderStorage = {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
    getAllKeys: async () => [...data.keys()],
  };
  const notifications: NotificationsPort = {
    ensurePermission: jest.fn(async () => true),
    schedule: jest.fn(async () => 'id-nuevo'),
    cancel: jest.fn(async () => undefined),
  };

  await render(
    <DataProvider value={repositories}>
      <SessionReminderSync notifications={notifications} storage={storage} />
    </DataProvider>
  );

  await waitFor(() => expect(data.get(`${REMINDER_KEY_PREFIX}${session.id}`)).toBe('id-nuevo'));
  expect(notifications.cancel).toHaveBeenCalledWith('id-antiguo');
  expect(notifications.schedule).toHaveBeenCalledWith(
    new Date(Date.parse(startsAt) - 5 * MINUTE),
    'Sesión Lock-In en 5 minutos',
    'Con Núria. Entra desde el chat.'
  );
});
