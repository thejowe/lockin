/**
 * Presencia sobre Supabase Realtime Presence.
 *
 * Un canal por sesión; la clave de presencia es el id de perfil, así que dos
 * pantallas abiertas de la misma persona cuentan una vez.
 */

import { getSupabaseClient } from './client';

import type { LockInSupabaseClient } from './client';
import type { PresenceAdapter } from '../presence';

export function createSupabasePresenceAdapter(
  getClient: () => LockInSupabaseClient = getSupabaseClient
): PresenceAdapter {
  return {
    join(sessionId, profileId, { onPeers, onConnection }) {
      const client = getClient();
      const channel = client.channel(`lockin:presence:${sessionId}`, {
        config: { presence: { key: profileId } },
      });

      channel
        .on('presence', { event: 'sync' }, () => onPeers(Object.keys(channel.presenceState())))
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            onConnection(true);
            void channel.track({ profileId });
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            onConnection(false);
          }
        });

      return () => {
        void channel.untrack();
        void client.removeChannel(channel);
      };
    },
  };
}
