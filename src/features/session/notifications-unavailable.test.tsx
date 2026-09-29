/**
 * Expo Go Android ya no trae `expo-notifications`: su `require` lanza
 * («Android Push notifications … was removed from Expo Go with the release of
 * SDK 53»). La superficie de sesiones se importa desde el layout de tabs, así
 * que ese `require` no puede ocurrir al importar ni romper al montar: los
 * recordatorios locales quedan desactivados y lo demás arranca igual.
 *
 * Todo este archivo corre con un `expo-notifications` que lanza al cargarse.
 */

import { render, waitFor } from '@testing-library/react-native';

import { DataProvider } from '@/data';
import { createMockRepositories, resetState } from '@/data/mock';
import { buildProfileInput } from '@/data/test-fixtures';

import { SessionReminderSync } from './index';
import { createNotificationsPort } from './notifications-port';

import type { ReminderStorage } from './reminders';

jest.mock('expo-notifications', () => {
  throw new Error(
    'expo-notifications: Android Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go with the release of SDK 53.'
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('sin expo-notifications (Expo Go Android)', () => {
  it('el puerto degrada a no disponible en vez de lanzar', () => {
    expect(createNotificationsPort()).toBeNull();
  });

  it('la sincronización de recordatorios monta y recorre los matches sin tocar avisos', async () => {
    resetState();
    const repositories = createMockRepositories();
    await repositories.profiles.saveCurrent(buildProfileInput());
    const list = jest.spyOn(repositories.matches, 'list');
    const storage: ReminderStorage = {
      getItem: jest.fn(async () => null),
      setItem: jest.fn(async () => undefined),
      removeItem: jest.fn(async () => undefined),
      getAllKeys: jest.fn(async () => []),
    };

    await render(
      <DataProvider value={repositories}>
        <SessionReminderSync storage={storage} />
      </DataProvider>
    );

    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(storage.getAllKeys).not.toHaveBeenCalled();
  });
});

describe('createNotificationsPort en Expo Go', () => {
  it('en Android ni intenta cargar expo-notifications', () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    jest.isolateModules(() => {
      const factory = jest.fn(() => ({}));
      jest.doMock('expo', () => ({ isRunningInExpoGo: () => true }));
      jest.doMock('expo-notifications', factory);
      const { Platform: IsolatedPlatform } = require('react-native');
      jest.replaceProperty(IsolatedPlatform, 'OS', 'android');

      const fresh = require('./notifications-port') as typeof import('./notifications-port');

      expect(fresh.createNotificationsPort()).toBeNull();
      expect(factory).not.toHaveBeenCalled();
    });
    /* eslint-enable @typescript-eslint/no-require-imports */
  });

  it('en iOS (donde los avisos locales siguen funcionando) mantiene el puerto', () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    jest.isolateModules(() => {
      jest.doMock('expo', () => ({ isRunningInExpoGo: () => true }));
      jest.doMock('expo-notifications', () => ({}));
      const { Platform: IsolatedPlatform } = require('react-native');
      jest.replaceProperty(IsolatedPlatform, 'OS', 'ios');

      const fresh = require('./notifications-port') as typeof import('./notifications-port');

      expect(fresh.createNotificationsPort()).not.toBeNull();
    });
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
});
