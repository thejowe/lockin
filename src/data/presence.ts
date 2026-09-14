/**
 * Presencia en una sesión Lock-In: quién tiene la pantalla de sesión abierta.
 *
 * No es un repositorio: no se guarda nada y no tiene contrato de persistencia.
 * `src/data/active.ts` elige el adaptador con la misma regla que los repositorios.
 */

export interface PresenceHandlers {
  /** Ids de perfil presentes en la sala, sin repetir, incluido el propio. */
  onPeers(profileIds: string[]): void;
  /** Estado de la conexión propia con la sala. */
  onConnection(online: boolean): void;
}

export interface PresenceAdapter {
  /** Entra en la sala de la sesión como `profileId`. Devuelve la función para salir. */
  join(sessionId: string, profileId: string, handlers: PresenceHandlers): () => void;
}

/** Salas en memoria del proceso. Es la del backend mock y la de los tests. */
export function createMemoryPresenceAdapter(): PresenceAdapter {
  const rooms = new Map<string, Map<symbol, { profileId: string; handlers: PresenceHandlers }>>();

  const publish = (sessionId: string) => {
    const room = rooms.get(sessionId);
    if (!room) return;
    const ids = [...new Set([...room.values()].map((member) => member.profileId))];
    room.forEach((member) => member.handlers.onPeers(ids));
  };

  return {
    join(sessionId, profileId, handlers) {
      const room = rooms.get(sessionId) ?? new Map();
      const key = Symbol(profileId);
      room.set(key, { profileId, handlers });
      rooms.set(sessionId, room);
      handlers.onConnection(true);
      publish(sessionId);

      return () => {
        room.delete(key);
        if (room.size === 0) rooms.delete(sessionId);
        publish(sessionId);
      };
    },
  };
}
