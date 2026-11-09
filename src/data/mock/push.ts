/**
 * Tokens push en el backend mock. No hay servidor que mande nada: basta con
 * guardar quién tiene qué token, con las mismas reglas que el SQL, para que la
 * app y los tests puedan comprobar el registro.
 */

import { defaultMockStore } from './store';

import type { MockStore } from './store';
import type { PushRepository } from '../repositories';

const TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/;

const byStore = new WeakMap<MockStore, Map<string, { userId: string; platform: string }>>();

/** Los tokens de ese store, por token. Para tests. */
export function mockPushTokens(store: MockStore = defaultMockStore) {
  let tokens = byStore.get(store);
  if (!tokens) {
    tokens = new Map();
    byStore.set(store, tokens);
  }
  return tokens;
}

export function createMockPushRepository(
  actorId: string,
  store: MockStore = defaultMockStore
): PushRepository {
  return {
    async register(token, platform) {
      if (!TOKEN.test(token) || (platform !== 'ios' && platform !== 'android')) {
        throw Object.assign(new Error('Token push no válido.'), { code: '23514' });
      }
      mockPushTokens(store).set(token, { userId: actorId, platform });
    },

    async unregister(token) {
      const tokens = mockPushTokens(store);
      if (tokens.get(token)?.userId === actorId) tokens.delete(token);
    },
  };
}
