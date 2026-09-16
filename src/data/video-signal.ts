/**
 * Señalización de la llamada de vídeo de una sesión Lock-In: SDP offer/answer y
 * candidatos ICE.
 *
 * No es un repositorio: es tráfico efímero de segundos, nadie lo lee después.
 * Mismo patrón que `presence.ts` — no hay tabla, no hay contrato de
 * persistencia, `src/data/active.ts` elige el adaptador con la misma regla.
 */

export type VideoSignalKind = 'offer' | 'answer' | 'ice-candidate' | 'hangup';

export interface VideoSignalMessage {
  kind: VideoSignalKind;
  /** profileId de quien envía — para que el receptor descarte sus propios ecos. */
  from: string;
  /** SDP para offer/answer, candidato serializado para ice-candidate, `null` para hangup. */
  payload: unknown;
}

export interface VideoSignalHandlers {
  onMessage(message: VideoSignalMessage): void;
  onConnection(online: boolean): void;
}

export interface VideoSignalChannel {
  /** Entra en el canal de señalización de la sesión. Devuelve la función para salir. */
  join(sessionId: string, profileId: string, handlers: VideoSignalHandlers): () => void;
  send(sessionId: string, message: VideoSignalMessage): void;
}

/** Salas en memoria del proceso. Es la del backend mock y la de los tests. */
export function createMemoryVideoSignalAdapter(): VideoSignalChannel {
  const rooms = new Map<
    string,
    Map<symbol, { profileId: string; handlers: VideoSignalHandlers }>
  >();

  return {
    join(sessionId, profileId, handlers) {
      const room = rooms.get(sessionId) ?? new Map();
      const key = Symbol(profileId);
      room.set(key, { profileId, handlers });
      rooms.set(sessionId, room);
      handlers.onConnection(true);

      return () => {
        room.delete(key);
        if (room.size === 0) rooms.delete(sessionId);
      };
    },

    send(sessionId, message) {
      const room = rooms.get(sessionId);
      if (!room) return;
      // Reenvía a todos salvo al propio emisor: comparar `from`, no la
      // identidad del miembro, porque la misma persona puede tener dos
      // pantallas abiertas y a esas sí les toca recibir el mensaje.
      room.forEach((member) => {
        if (member.profileId !== message.from) member.handlers.onMessage(message);
      });
    },
  };
}
