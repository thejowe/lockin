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
  // `repositories.premium` solo se toca en efectos y callbacks, nunca al renderizar:
  // el export estático de la web renderiza sin backend y el acceso lanzaría.
  const repositories = useRepositories();
  const [quotas, setQuotas] = useState<PremiumQuotas | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setQuotas(await repositories.premium.getQuotas());
    } catch {
      // Sin cupos conocidos no se frena nada en el cliente: el servidor manda.
    } finally {
      setLoading(false);
    }
  }, [repositories]);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = repositories.premium.subscribeQuotas((next) => {
      if (!cancelled) setQuotas(next);
    });
    void repositories.premium.getQuotas().then(
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
  }, [repositories]);

  const undo = useCallback(() => repositories.premium.undoLastDecision(), [repositories]);
  const boost = useCallback(() => repositories.premium.activateBoost(), [repositories]);

  return { quotas, loading, undo, boost, refresh };
}
