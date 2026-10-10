/**
 * Señalización de vídeo sobre Supabase Realtime Broadcast.
 *
 * Un canal por sesión, sin `track()`: a diferencia de presencia, aquí no hace
 * falta publicar quién está, solo reenviar mensajes efímeros de señalización.
 */

import { getSupabaseClient } from './client';
import { trackLiveChannel } from './live-channels';

import type { LockInSupabaseClient } from './client';
import type { VideoSignalChannel, VideoSignalMessage } from '../video-signal';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function createSupabaseVideoSignalAdapter(
  getClient: () => LockInSupabaseClient = getSupabaseClient
): VideoSignalChannel {
  // `send` necesita el canal que abrió `join` para esta sesión: sin tabla ni
  // estado propio, reenviar solo es posible mientras el canal siga suscrito.
  const channels = new Map<string, RealtimeChannel>();

  return {
    join(sessionId, profileId, { onMessage, onConnection, onRevoked }) {
      let active = true;
      const client = getClient();
      const channel = client.channel(`lockin:video:${sessionId}`, { config: { private: true } });

      channel
        .on('broadcast', { event: 'signal' }, ({ payload }: { payload: VideoSignalMessage }) => {
          if (active && payload.from !== profileId) onMessage(payload);
        })
        .subscribe((status) => {
          if (!active) return;
          if (status === 'SUBSCRIBED') {
            onConnection(true);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            onConnection(false);
          }
        });

      channels.set(sessionId, channel);

      const leave = () => {
        // removeChannel es asíncrono: el SDK aún puede entregar eventos en vuelo.
        if (!active) return;
        active = false;
        untrack();
        // Solo si el canal sigue siendo el de esta unión: otra pudo reemplazarlo.
        if (channels.get(sessionId) === channel) channels.delete(sessionId);
        void client.removeChannel(channel);
      };
      // Bloquear a la otra persona cierra el canal y cuelga la llamada.
      const untrack = trackLiveChannel(client, sessionId, () => {
        const wasActive = active;
        leave();
        if (!wasActive) return;
        onConnection(false);
        onRevoked?.();
      });

      return leave;
    },

    send(sessionId, message) {
      const channel = channels.get(sessionId);
      if (!channel) return;
      void channel.send({ type: 'broadcast', event: 'signal', payload: message });
    },
  };
}
