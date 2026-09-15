/**
 * La sesión viva de un match y la que toca valorar, al día.
 *
 * Se releen con cada aviso del repositorio y con un tic de 30 s: los umbrales de
 * ventana y caducidad se cruzan sin que llegue ningún evento por la red. La
 * valorable no necesita suscripción propia —solo la cambias tú, y `rate` no
 * avisa a nadie porque la valoración es privada—, pero sí tiene que releerse con
 * la otra: `useQuery` da un `refresh` por consulta, así que las dos se refrescan
 * por un único `refresh` y no se puede olvidar una. Si se olvidara, la tarjeta
 * se quedaría pidiendo una valoración ya escrita hasta salir del chat.
 */

import { useCallback, useEffect, useState } from 'react';

import { useQuery, useRepositories } from '@/data';

import { useResolvedOrPrevious } from './use-resolved-or-previous';

import type { LockInSession } from '@/data';

export const SESSION_TICK_MS = 30_000;

export function useActiveSession(matchId: string): {
  session: LockInSession | null;
  ratable: LockInSession | null;
  nowMs: number;
  refresh: () => void;
} {
  const repositories = useRepositories();
  const activeQuery = useQuery(`session:active:${matchId}`, () =>
    repositories.sessions.getActive(matchId)
  );
  const ratableQuery = useQuery(`session:ratable:${matchId}`, () =>
    repositories.sessions.getRatable(matchId)
  );
  const session = useResolvedOrPrevious(activeQuery.data, activeQuery.loading);
  const ratable = useResolvedOrPrevious(ratableQuery.data, ratableQuery.loading);
  const refreshActive = activeQuery.refresh;
  const refreshRatable = ratableQuery.refresh;
  const refresh = useCallback(() => {
    refreshActive();
    refreshRatable();
  }, [refreshActive, refreshRatable]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(
    () => repositories.sessions.subscribe(matchId, refresh),
    [repositories, matchId, refresh]
  );

  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now());
      refresh();
    }, SESSION_TICK_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { session, ratable, nowMs, refresh };
}
