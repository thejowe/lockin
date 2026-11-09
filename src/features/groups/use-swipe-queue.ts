/**
 * Cola de cartas de un deck de grupos: lee la lista, retira cada carta en
 * cuanto se decide y la devuelve si el guardado falla.
 *
 * Una carta que el servidor ya no reconoce (el grupo se borró, la persona
 * entró en otro grupo) no vuelve: no hay nada que decidir sobre ella.
 */

import { useCallback, useMemo, useState } from 'react';

import { GroupError, useQuery, type Decision, type GroupSwipeResult } from '@/data';

export interface SwipeQueue<T> {
  /** `null` mientras carga por primera vez. */
  cards: T[] | null;
  loading: boolean;
  /** Fallo al cargar la lista. */
  error: Error | null;
  /** El último guardado falló y su carta ha vuelto al deck. */
  saveFailed: boolean;
  decide: (item: T, decision: Decision) => Promise<GroupSwipeResult | null>;
  refresh: () => void;
}

const GONE_REASONS = new Set(['unavailable', 'candidate-unavailable']);

export function useSwipeQueue<T>(
  queryKey: string,
  load: () => Promise<T[]>,
  keyOf: (item: T) => string,
  send: (item: T, decision: Decision) => Promise<GroupSwipeResult>
): SwipeQueue<T> {
  const query = useQuery(queryKey, load);
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [saveFailed, setSaveFailed] = useState(false);

  const cards = useMemo(
    () => (query.data ? query.data.filter((item) => !gone.has(keyOf(item))) : null),
    // `keyOf` es estable por contrato: una función de módulo o memorizada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data, gone]
  );

  const decide = useCallback(
    async (item: T, decision: Decision) => {
      const key = keyOf(item);
      setGone((current) => new Set(current).add(key));
      setSaveFailed(false);
      try {
        return await send(item, decision);
      } catch (cause: unknown) {
        if (cause instanceof GroupError && GONE_REASONS.has(cause.reason)) return null;
        setGone((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
        setSaveFailed(true);
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [send]
  );

  return {
    cards,
    loading: query.loading,
    error: query.error,
    saveFailed,
    decide,
    refresh: query.refresh,
  };
}
