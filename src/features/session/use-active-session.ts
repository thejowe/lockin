/**
 * La sesión viva de un match, al día.
 *
 * Se relee con cada aviso del repositorio y con un tic de 30 s: los umbrales de
 * ventana y caducidad se cruzan sin que llegue ningún evento por la red.
 */

import { useEffect, useState } from 'react';

import { useQuery, useRepositories } from '@/data';

import { useResolvedOrPrevious } from './use-resolved-or-previous';

import type { LockInSession } from '@/data';

export const SESSION_TICK_MS = 30_000;

export function useActiveSession(matchId: string): {
  session: LockInSession | null;
  nowMs: number;
  refresh: () => void;
} {
  const repositories = useRepositories();
  const query = useQuery(`session:active:${matchId}`, () =>
    repositories.sessions.getActive(matchId)
  );
  const session = useResolvedOrPrevious(query.data, query.loading);
  const { refresh } = query;
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

  return { session, nowMs, refresh };
}
