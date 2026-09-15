/**
 * Las rachas de pareja de todos tus matches, para la lista de Matches.
 *
 * Una sola lectura para toda la lista —no una por fila— y se relee al volver a
 * la pestaña, que es cuando puede haber cambiado (acabas de hacer una sesión
 * desde el chat). El primer foco coincide con el montaje, donde `useQuery` ya
 * lee: se salta para no pedir dos veces lo mismo al abrir.
 *
 * `useNow` hace que una racha que caduca con la pestaña abierta desaparezca sin
 * esperar a otra lectura. Si la consulta falla, ninguna fila lleva racha: nunca
 * es un error que la lista muestre. Nunca lee `session_ratings` (ver
 * `@/data/streaks`).
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

import { useQuery, useRepositories } from '@/data';

import { visibleStreak } from './streak';
import { useNow } from './use-now';

export const STREAKS_TICK_MS = 60_000;

export function useMatchStreaks(): {
  streakFor(matchId: string): number | null;
  refresh(): void;
} {
  const repositories = useRepositories();
  const { data, error, refresh } = useQuery('session:streaks:list', () =>
    repositories.sessions.listStreaks()
  );
  const nowMs = useNow(STREAKS_TICK_MS);
  const focusedOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      refresh();
    }, [refresh])
  );

  const streakFor = (matchId: string) => {
    if (error) return null;
    return visibleStreak(
      data?.find((entry) => entry.matchId === matchId),
      nowMs
    );
  };

  return { streakFor, refresh };
}
