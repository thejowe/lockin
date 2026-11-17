/**
 * Mensajes sin leer contra las RPC de
 * `supabase/migrations/20261117120000_chat_reads.sql`. La tabla `chat_reads` no
 * se lee ni se escribe a pelo desde el cliente.
 */

import type { UnreadRepository } from '../repositories';
import type { UnreadCounts } from '../types';
import type { LockInSupabaseClient } from './client';

export function createSupabaseUnreadRepository(deps: {
  getClient: () => LockInSupabaseClient;
  getUserId: () => Promise<string>;
}): UnreadRepository {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  async function mark(kind: 'match' | 'group', chatId: string): Promise<void> {
    await deps.getUserId();
    const { error } = await deps
      .getClient()
      .rpc('mark_chat_read', { p_kind: kind, p_chat_id: chatId });
    if (error) throw error;
    notify();
  }

  return {
    async counts() {
      await deps.getUserId();
      const { data, error } = await deps.getClient().rpc('unread_message_counts');
      if (error) throw error;

      const result: UnreadCounts = { total: 0, byMatch: {}, byGroup: {} };
      for (const row of data ?? []) {
        const target = row.chat_kind === 'group' ? result.byGroup : result.byMatch;
        target[row.chat_id] = row.unread;
        result.total += row.unread;
      }
      return result;
    },

    markMatchRead: (matchId) => mark('match', matchId),
    markGroupRead: (groupId) => mark('group', groupId),

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
