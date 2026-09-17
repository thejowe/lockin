/**
 * Todo lo que necesita la pantalla de sesión: la sesión, su match, el perfil
 * propio y el desfase entre el reloj del dispositivo y el del servidor.
 */

import { useEffect, useState } from 'react';

import { useQuery, useRepositories } from '@/data';

import type { LockInSession, MatchWithProfile, Profile } from '@/data';

export interface SessionRoom {
  session: LockInSession | null;
  match: MatchWithProfile | null;
  me: Profile | null;
  loading: boolean;
  error: Error | null;
  /** Milisegundos a sumar a `Date.now()` para tener la hora del servidor. */
  offsetMs: number;
}

export function useSessionRoom(sessionId: string): SessionRoom {
  const repositories = useRepositories();

  const sessionQuery = useQuery(`session:${sessionId}`, () =>
    repositories.sessions.getById(sessionId)
  );
  const session = sessionQuery.data;
  const matchId = session?.matchId ?? null;

  const matchQuery = useQuery(`match:${matchId ?? 'ninguno'}`, () =>
    matchId ? repositories.matches.getById(matchId) : Promise.resolve(null)
  );
  const match = matchQuery.data;
  const meQuery = useQuery('profile:current', () => repositories.profiles.getCurrent());

  const refreshSession = sessionQuery.refresh;
  useEffect(() => {
    if (!matchId) return;
    return repositories.sessions.subscribe(matchId, refreshSession);
  }, [repositories, matchId, refreshSession]);

  const [offsetMs, setOffsetMs] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const sentAt = Date.now();
    repositories.sessions
      .serverNow()
      .then((serverIso) => {
        if (cancelled) return;
        // La hora del servidor corresponde, como mejor estimación, al punto medio del viaje.
        const receivedAt = Date.now();
        setOffsetMs(Date.parse(serverIso) - (sentAt + receivedAt) / 2);
      })
      .catch(() => {
        // Sin hora del servidor se sigue con la del dispositivo (spec, sección 3).
      });
    return () => {
      cancelled = true;
    };
  }, [repositories]);

  return {
    session,
    match,
    me: meQuery.data,
    loading: (sessionQuery.loading && !session) || (matchQuery.loading && !match),
    error: sessionQuery.error ?? matchQuery.error,
    offsetMs,
  };
}
