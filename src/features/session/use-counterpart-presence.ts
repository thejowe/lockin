/**
 * Si la otra persona tiene abierta la pantalla de la sesión.
 *
 * Tres estados y no dos: sin conexión propia no se sabe nada de la otra
 * persona, y decir "aún no ha entrado" sería afirmar algo que no se ha visto.
 */

import { useEffect, useState } from 'react';

import { presence } from '@/data';

import type { PresenceAdapter } from '@/data';

export type CounterpartPresence = 'aqui' | 'ausente' | 'sin-conexion';

export function useCounterpartPresence(
  sessionId: string | null,
  myProfileId: string | null,
  counterpartId: string | null,
  adapter: PresenceAdapter = presence
): CounterpartPresence {
  const [peers, setPeers] = useState<string[]>([]);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (!sessionId || !myProfileId) return;
    return adapter.join(sessionId, myProfileId, { onPeers: setPeers, onConnection: setOnline });
  }, [adapter, sessionId, myProfileId]);

  if (!online) return 'sin-conexion';
  return counterpartId !== null && peers.includes(counterpartId) ? 'aqui' : 'ausente';
}
