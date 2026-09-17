/**
 * La sesión viva de un match, la que toca valorar y su racha, al día.
 *
 * Se releen con cada aviso del repositorio y con un tic de 30 s: los umbrales de
 * ventana y caducidad se cruzan sin que llegue ningún evento por la red. La
 * valorable no necesita suscripción propia —solo la cambias tú, y `rate` no
 * avisa a nadie porque la valoración es privada—, pero sí tiene que releerse con
 * la otra: `useQuery` da un `refresh` por consulta, así que las tres se
 * refrescan por un único `refresh` y no se puede olvidar una. Si se olvidara la
 * de valorable, la tarjeta se quedaría pidiendo una valoración ya escrita hasta
 * salir del chat; si se olvidara la de la racha, entrar la segunda persona no
 * subiría el número solo.
 *
 * La racha nunca lee `session_ratings` (ver `@/data/streaks`), y si su consulta
 * falla se trata como "sin racha": nunca como un error que la tarjeta muestre.
 */

import { useCallback, useEffect, useState } from 'react';

import { useQuery, useRepositories } from '@/data';


import type { LockInSession, MatchStreak } from '@/data';

export const SESSION_TICK_MS = 30_000;

export function useActiveSession(matchId: string): {
  session: LockInSession | null;
  ratable: LockInSession | null;
  streak: MatchStreak | null;
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
  const streaksQuery = useQuery('session:streaks', () => repositories.sessions.listStreaks());
  const session = activeQuery.data;
  const ratable = ratableQuery.data;
  const streaks = streaksQuery.data;
  const streak = streaks?.find((entry) => entry.matchId === matchId) ?? null;
  const refreshActive = activeQuery.refresh;
  const refreshRatable = ratableQuery.refresh;
  const refreshStreaks = streaksQuery.refresh;
  const refresh = useCallback(() => {
    refreshActive();
    refreshRatable();
    refreshStreaks();
  }, [refreshActive, refreshRatable, refreshStreaks]);
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

  return { session, ratable, streak, nowMs, refresh };
}
