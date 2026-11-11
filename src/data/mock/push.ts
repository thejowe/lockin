/**
 * Tokens push en el backend mock. No hay servidor que mande nada: basta con
 * guardar quién tiene qué token, con las mismas reglas que el SQL, para que la
 * app y los tests puedan comprobar el registro.
 */

import { defaultMockStore } from './store';

import type { MockStore } from './store';
import type { PushRepository } from '../repositories';
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from '../notification-settings';
import type { AppLocale } from '@/i18n';

const TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/;

const byStore = new WeakMap<
  MockStore['state'],
  Map<string, { userId: string; platform: string }>
>();
const settingsByStore = new WeakMap<
  MockStore['state'],
  Map<
    string,
    {
      prefs: NotificationPrefs;
      locale: AppLocale | null;
      seenAt: number | null;
      lastActiveAt: number | null;
    }
  >
>();

export function mockNotificationSettings(actorId: string, store: MockStore = defaultMockStore) {
  let settings = settingsByStore.get(store.state);
  if (!settings) {
    settings = new Map();
    settingsByStore.set(store.state, settings);
  }
  let state = settings.get(actorId);
  if (!state) {
    state = {
      prefs: { ...DEFAULT_NOTIFICATION_PREFS },
      locale: null,
      seenAt: null,
      lastActiveAt: null,
    };
    settings.set(actorId, state);
  }
  return state;
}

/** Los tokens de ese store, por token. Para tests. */
export function mockPushTokens(store: MockStore = defaultMockStore) {
  let tokens = byStore.get(store.state);
  if (!tokens) {
    tokens = new Map();
    byStore.set(store.state, tokens);
  }
  return tokens;
}

export function createMockPushRepository(
  actorId: string,
  store: MockStore = defaultMockStore
): PushRepository {
  return {
    async currentAccountId() {
      return actorId;
    },
    async register(token, platform, locale) {
      if (locale && !['es', 'en', 'ca'].includes(locale))
        throw Object.assign(new Error('Invalid locale'), { code: '22023' });
      if (!TOKEN.test(token) || (platform !== 'ios' && platform !== 'android')) {
        throw Object.assign(new Error('Token push no válido.'), { code: '23514' });
      }
      mockPushTokens(store).set(token, { userId: actorId, platform });
      if (locale) mockNotificationSettings(actorId, store).locale = locale;
    },

    async unregister(token) {
      const tokens = mockPushTokens(store);
      if (tokens.get(token)?.userId === actorId) tokens.delete(token);
    },
    async getPreferences() {
      return { ...mockNotificationSettings(actorId, store).prefs };
    },
    async setPreferences(prefs) {
      if (
        Object.entries(prefs).some(
          ([key, value]) =>
            !Object.hasOwn(DEFAULT_NOTIFICATION_PREFS, key) || typeof value !== 'boolean'
        )
      ) {
        throw Object.assign(new Error('Invalid preferences'), { code: '22023' });
      }
      Object.assign(mockNotificationSettings(actorId, store).prefs, prefs);
    },
    async setLocale(locale) {
      if (!['es', 'en', 'ca'].includes(locale))
        throw Object.assign(new Error('Invalid locale'), { code: '22023' });
      mockNotificationSettings(actorId, store).locale = locale;
    },
    async markIncomingLikesSeen() {
      mockNotificationSettings(actorId, store).seenAt = store.nowMs();
    },
    async touchLastActive() {
      const settings = mockNotificationSettings(actorId, store);
      if (settings.lastActiveAt === null || settings.lastActiveAt <= store.nowMs() - 15 * 60_000)
        settings.lastActiveAt = store.nowMs();
    },
  };
}
