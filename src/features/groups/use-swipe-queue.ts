/**
 * Cola de cartas de un deck de grupos: lee la lista, retira cada carta en
 * cuanto se decide y la devuelve si el guardado falla.
 *
 * Una carta que el servidor ya no reconoce (el grupo se borró, la persona
 * entró en otro grupo) no vuelve: no hay nada que decidir sobre ella.
 */

import { useCallback, useMemo, useRef, useState } from 'react';

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
  // Cada lectura incluye solo los swipes ya confirmados cuando empezó. En
  // lecturas posteriores manda el servidor, también cuando caduca un pase.
  const committed = useRef(0);
  const query = useQuery(queryKey, async () => {
    const version = committed.current;
    return { version, items: await load() };
  });
  const [gone, setGone] = useState<ReadonlyMap<string, number>>(new Map());
  const [saveFailed, setSaveFailed] = useState(false);

  const cards = useMemo(() => {
    const snapshot = query.data;
    return snapshot
      ? snapshot.items.filter((item) => (gone.get(keyOf(item)) ?? 0) <= snapshot.version)
      : null;
  }, [query.data, gone, keyOf]);

  const decide = useCallback(
    async (item: T, decision: Decision) => {
      const key = keyOf(item);
      setGone((current) => new Map(current).set(key, Infinity));
      setSaveFailed(false);
      try {
        const result = await send(item, decision);
        const version = ++committed.current;
        setGone((current) => new Map(current).set(key, version));
        return result;
      } catch (cause: unknown) {
        if (cause instanceof GroupError && GONE_REASONS.has(cause.reason)) {
          const version = ++committed.current;
          setGone((current) => new Map(current).set(key, version));
          return null;
        }
        setGone((current) => {
          const next = new Map(current);
          next.delete(key);
          return next;
        });
        setSaveFailed(true);
        return null;
      }
    },
    [send, keyOf]
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
