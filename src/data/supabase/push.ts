/**
 * Tokens, preferencias y marcas push contra RPC propias de Supabase. La tabla
 * `push_tokens` no tiene políticas de cliente; ningún dato se escribe a pelo.
 */

import type { PushRepository } from '../repositories';
import type { LockInSupabaseClient } from './client';

export function createSupabasePushRepository(deps: {
  getClient: () => LockInSupabaseClient;
  getUserId: () => Promise<string>;
}): PushRepository {
  return {
    async currentAccountId() {
      const { data, error } = await deps.getClient().auth.getSession();
      if (error) throw error;
      return data.session?.user.id ?? null;
    },
    async register(token, platform, locale) {
      await deps.getUserId();
      const { error } = await deps.getClient().rpc('register_push_token', {
        p_token: token,
        p_platform: platform,
        ...(locale ? { p_locale: locale } : {}),
      });
      if (error) throw error;
    },

    async unregister(token) {
      const { error } = await deps.getClient().rpc('unregister_push_token', { p_token: token });
      if (error) throw error;
    },
    async getPreferences() {
      await deps.getUserId();
      const { data, error } = await deps.getClient().rpc('notification_prefs');
      if (error) throw error;
      if (!data) throw new Error('No notification preferences');
      return data;
    },
    async setPreferences(prefs) {
      const { error } = await deps.getClient().rpc('set_notification_prefs', { p_prefs: prefs });
      if (error) throw error;
    },
    async setLocale(locale) {
      const { error } = await deps.getClient().rpc('set_notification_locale', { p_locale: locale });
      if (error) throw error;
    },
    async markIncomingLikesSeen() {
      const { error } = await deps.getClient().rpc('mark_incoming_likes_seen');
      if (error) throw error;
    },
    async touchLastActive() {
      // No ensureUserId: arrancar en bienvenida nunca crea una cuenta para registrar actividad.
      const { error } = await deps.getClient().rpc('touch_last_active');
      if (error) throw error;
    },
  };
}
