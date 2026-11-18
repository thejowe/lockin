import { useCallback, useRef, useState } from 'react';

import { useReduceMotion } from '@/hooks/use-reduce-motion';

/** Keep the event in the screen, so refreshes and recycled rows cannot replay an arrival. */
export function useArrivals() {
  const reduced = useReduceMotion();
  const seen = useRef(new Map<string, 'pending' | 'started'>());
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());

  const start = useCallback((id: string) => {
    if (seen.current.has(id)) return;
    seen.current.set(id, 'pending');
    setPending((previous) => new Set(previous).add(id));
  }, []);

  const claim = useCallback((id: string) => {
    if (seen.current.get(id) !== 'pending') return false;
    seen.current.set(id, 'started');
    return true;
  }, []);

  const finish = useCallback((id: string) => {
    setPending((previous) => {
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
  }, []);

  return { reduced, start, claim, finish, pending };
}

export type Arrivals = ReturnType<typeof useArrivals>;
