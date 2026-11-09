/**
 * Tokens push contra Supabase: dos RPC (`register_push_token`,
 * `unregister_push_token`). La tabla `push_tokens` no tiene políticas.
 */

import type { PushRepository } from '../repositories';
import type { LockInSupabaseClient } from './client';

export function createSupabasePushRepository(deps: {
  getClient: () => LockInSupabaseClient;
  getUserId: () => Promise<string>;
}): PushRepository {
  return {
    async register(token, platform) {
      await deps.getUserId();
      const { error } = await deps
        .getClient()
        .rpc('register_push_token', { p_token: token, p_platform: platform });
      if (error) throw error;
    },

    async unregister(token) {
      const { error } = await deps.getClient().rpc('unregister_push_token', { p_token: token });
      if (error) throw error;
    },
  };
}
