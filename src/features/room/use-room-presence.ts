import { useEffect, useState } from 'react';

import { roomPresence } from '@/data';

import type { PresenceAdapter } from '@/data';

/**
 * Presencia de todas las personas de la sala, incluida la propia.
 * La pantalla pasa `roomId: null` fuera de `isInRoomJoinWindow`: solo se abre
 * el canal privado dentro de la ventana y para quien ha aceptado.
 * Sin conexión propia, `presentIds` no confirma quién sigue dentro.
 */
export function useRoomPresence(
  roomId: string | null,
  myProfileId: string | null,
  adapter: PresenceAdapter = roomPresence
): { online: boolean; presentIds: ReadonlySet<string> } {
  const [presentIds, setPresentIds] = useState<ReadonlySet<string>>(() => new Set());
  const [online, setOnline] = useState(true);
  const [previous, setPrevious] = useState({ roomId, myProfileId, adapter });

  // Reinicia antes de pintar otra identidad, sin conservar los peers de la anterior.
  if (
    previous.roomId !== roomId ||
    previous.myProfileId !== myProfileId ||
    previous.adapter !== adapter
  ) {
    setPrevious({ roomId, myProfileId, adapter });
    setPresentIds(new Set());
    setOnline(true);
  }

  useEffect(() => {
    if (!roomId || !myProfileId) return;

    let active = true;
    const leave = adapter.join(roomId, myProfileId, {
      onPeers: (ids) => {
        if (active) setPresentIds(new Set(ids));
      },
      onConnection: (connected) => {
        if (active) setOnline(connected);
      },
    });
    return () => {
      active = false;
      leave();
    };
  }, [adapter, roomId, myProfileId]);

  return { online, presentIds };
}
