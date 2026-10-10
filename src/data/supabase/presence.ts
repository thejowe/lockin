/**
 * Presencia sobre Supabase Realtime Presence.
 *
 * Un canal por sesión; la clave de presencia es el id de perfil, así que dos
 * pantallas abiertas de la misma persona cuentan una vez.
 */

import { getSupabaseClient } from './client';
import { trackLiveChannel } from './live-channels';

import type { LockInSupabaseClient } from './client';
import type { PresenceAdapter } from '../presence';

export function createSupabasePresenceAdapter(
  getClient: () => LockInSupabaseClient = getSupabaseClient,
  topicPrefix = 'lockin:presence:'
): PresenceAdapter {
  return {
    join(sessionId, profileId, { onPeers, onConnection, onRevoked }) {
      let active = true;
      const client = getClient();
      const channel = client.channel(`${topicPrefix}${sessionId}`, {
        config: { presence: { key: profileId }, private: true },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          if (active) onPeers(Object.keys(channel.presenceState()));
        })
        .subscribe((status) => {
          if (!active) return;
          if (status === 'SUBSCRIBED') {
            onConnection(true);
            void channel.track({ profileId });
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            onConnection(false);
          }
        });

      const leave = () => {
        // removeChannel es asíncrono: el SDK aún puede entregar eventos en vuelo.
        if (!active) return;
        active = false;
        untrack();
        void channel.untrack();
        void client.removeChannel(channel);
      };
      // Bloquear a alguien de esta sala cierra el canal desde aquí.
      const untrack = trackLiveChannel(client, sessionId, () => {
        const wasActive = active;
        leave();
        if (!wasActive) return;
        onConnection(false);
        onRevoked?.();
      });

      return leave;
    },
  };
}
