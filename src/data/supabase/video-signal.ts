/**
 * Señalización de vídeo sobre Supabase Realtime Broadcast.
 *
 * Un canal por sesión, sin `track()`: a diferencia de presencia, aquí no hace
 * falta publicar quién está, solo reenviar mensajes efímeros de señalización.
 */

import { getSupabaseClient } from './client';

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
    join(sessionId, profileId, { onMessage, onConnection }) {
      const client = getClient();
      const channel = client.channel(`lockin:video:${sessionId}`);

      channel
        .on('broadcast', { event: 'signal' }, ({ payload }: { payload: VideoSignalMessage }) => {
          if (payload.from !== profileId) onMessage(payload);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            onConnection(true);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            onConnection(false);
          }
        });

      channels.set(sessionId, channel);

      return () => {
        channels.delete(sessionId);
        void client.removeChannel(channel);
      };
    },

    send(sessionId, message) {
      const channel = channels.get(sessionId);
      if (!channel) return;
      void channel.send({ type: 'broadcast', event: 'signal', payload: message });
    },
  };
}
