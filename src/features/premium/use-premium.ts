/**
 * Cupos y acciones de pago de quien usa la app.
 *
 * Los cupos viven en el servidor; aquí solo se leen una vez y después se
 * siguen por `subscribeQuotas`, que avisa tras cada decisión, deshacer, Boost
 * o cambio de Premium. Así el aviso «Te quedan N likes» y el freno del gesto
 * nunca dependen de una cuenta hecha en el móvil.
 *
 * Cada llamada al hook lleva su propio estado: dos pantallas que lo usen a la
 * vez se enteran las dos por la suscripción.
 */

import { useCallback, useEffect, useState } from 'react';

import { useRepositories } from '@/data';

import type { PremiumQuotas } from '@/data';

export interface PremiumState {
  /** Los cupos vigentes, o `null` mientras se leen (o si la lectura falló). */
  quotas: PremiumQuotas | null;
  loading: boolean;
  /** Deshace la última decisión. Devuelve el perfil devuelto al deck, o `null` si no había nada. */
  undo: () => Promise<string | null>;
  /** Activa el Boost. Devuelve cuándo termina, en ISO. */
  boost: () => Promise<string>;
  /** Vuelve a leer los cupos. */
  refresh: () => Promise<void>;
}

export function usePremium(): PremiumState {
  const { premium } = useRepositories();
  const [quotas, setQuotas] = useState<PremiumQuotas | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setQuotas(await premium.getQuotas());
    } catch {
      // Sin cupos conocidos no se frena nada en el cliente: el servidor manda.
    } finally {
      setLoading(false);
    }
  }, [premium]);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = premium.subscribeQuotas((next) => {
      if (!cancelled) setQuotas(next);
    });
    void premium.getQuotas().then(
      (first) => {
        if (cancelled) return;
        // Un aviso puede haber llegado antes que la primera lectura: manda el más nuevo.
        setQuotas((current) => current ?? first);
        setLoading(false);
      },
      () => {
        if (!cancelled) setLoading(false);
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [premium]);

  const undo = useCallback(() => premium.undoLastDecision(), [premium]);
  const boost = useCallback(() => premium.activateBoost(), [premium]);

  return { quotas, loading, undo, boost, refresh };
}
