/**
 * Mensajes sin leer del backend mock: espejo de
 * `supabase/migrations/20261117120000_chat_reads.sql` (`unread_message_counts`
 * y `mark_chat_read`), con las mismas reglas.
 */

import { defaultMockStore, isBlockedPair } from './store';

import type { MockStore } from './store';
import type { UnreadRepository } from '../repositories';
import type { UnreadCounts } from '../types';

const UNREAD_TOPIC = (actorId: string) => `unread:${actorId}`;

export function createMockUnreadRepository(
  actorId: string,
  store: MockStore = defaultMockStore
): UnreadRepository {
  const readKey = (kind: 'match' | 'group', chatId: string) => `${actorId}:${kind}:${chatId}`;

  function mark(kind: 'match' | 'group', chatId: string): void {
    const state = store.state;
    const member =
      kind === 'match'
        ? state.matches.some((match) => match.id === chatId && match.profileIds.includes(actorId))
        : state.groupMembers.some((entry) => entry.groupId === chatId && entry.userId === actorId);
    if (!member) {
      throw Object.assign(new Error('No es un chat tuyo'), { code: '42501' });
    }
    const now = new Date().toISOString();
    const previous = state.chatReads.get(readKey(kind, chatId));
    // Solo hacia delante, como el `greatest()` de la RPC.
    if (previous === undefined || previous < now) state.chatReads.set(readKey(kind, chatId), now);
    store.notify(UNREAD_TOPIC(actorId));
  }

  return {
    async counts() {
      const state = store.state;
      const result: UnreadCounts = { total: 0, byMatch: {}, byGroup: {} };

      for (const match of state.matches) {
        if (!match.profileIds.includes(actorId)) continue;
        if (isBlockedPair(state, match.profileIds[0], match.profileIds[1])) continue;
        const readAt = state.chatReads.get(readKey('match', match.id));
        const unread = state.messages.filter(
          (message) =>
            message.matchId === match.id &&
            message.senderId !== actorId &&
            (readAt === undefined || message.sentAt > readAt)
        ).length;
        if (unread > 0) {
          result.byMatch[match.id] = unread;
          result.total += unread;
        }
      }

      for (const membership of state.groupMembers) {
        if (membership.userId !== actorId) continue;
        const since =
          state.chatReads.get(readKey('group', membership.groupId)) ?? membership.joinedAt;
        const unread = state.groupMessages.filter(
          (message) =>
            message.groupId === membership.groupId &&
            message.senderId !== actorId &&
            !isBlockedPair(state, actorId, message.senderId) &&
            message.sentAt > since
        ).length;
        if (unread > 0) {
          result.byGroup[membership.groupId] = unread;
          result.total += unread;
        }
      }

      return result;
    },

    async markMatchRead(matchId) {
      mark('match', matchId);
    },

    async markGroupRead(groupId) {
      mark('group', groupId);
    },

    subscribe(listener) {
      return store.subscribeTo(UNREAD_TOPIC(actorId), listener);
    },
  };
}
