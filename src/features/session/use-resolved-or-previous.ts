/**
 * El último valor resuelto mientras una consulta se relee.
 *
 * Copia deliberada de la función privada de `src/features/chat/use-conversation.ts`:
 * `useQuery` publica `data: null` en cada relectura, y sin esto la tarjeta y la
 * pantalla de sesión parpadearían a su estado vacío con cada aviso de realtime.
 * Si `arquitecto` arregla `useQuery`, se borran las dos copias.
 */

import { useState } from 'react';

export function useResolvedOrPrevious<T>(data: T | null, loading: boolean): T | null {
  const [lastResolved, setLastResolved] = useState<T | null>(null);

  if (!loading) {
    if (lastResolved !== data) setLastResolved(data);
    return data;
  }

  return lastResolved;
}
