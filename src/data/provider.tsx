/**
 * Acceso a los repositorios desde React.
 *
 * `DataProvider` existe para poder inyectar una implementación distinta en tests
 * o en un Storybook sin tocar las pantallas. Sin provider, `useRepositories`
 * devuelve la implementación activa de `src/data/active.ts`.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { repositories as activeRepositories } from './active';

import type { Repositories } from './repositories';

const RepositoriesContext = createContext<Repositories | null>(null);

export function DataProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  /** Implementación a inyectar. Por defecto, la activa del proyecto. */
  value?: Repositories;
}) {
  const resolved = useMemo(() => value ?? activeRepositories, [value]);

  return <RepositoriesContext.Provider value={resolved}>{children}</RepositoriesContext.Provider>;
}

export function useRepositories(): Repositories {
  return useContext(RepositoriesContext) ?? activeRepositories;
}

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  /** Vuelve a ejecutar la consulta. */
  refresh: () => void;
}

/** Resultado ya resuelto, etiquetado con la petición a la que pertenece. */
interface Resolved<T> {
  key: string;
  data: T | null;
  error: Error | null;
}

/**
 * Lee datos de un repositorio dentro de un componente.
 *
 * Es lo mínimo para no repetir el mismo `useEffect` en cada pantalla; si el
 * proyecto acaba necesitando caché o reintentos, se sustituye aquí por una
 * librería de verdad sin tocar las pantallas.
 *
 * `loading` se deriva en render comparando la petición vigente con la última
 * resuelta — así no hace falta un `setState` síncrono dentro del efecto, que
 * provocaría un render en cascada por cada consulta.
 *
 * @param key Identifica la consulta. Cambiarlo relanza `run`; mantenerlo estable
 *   evita refetches. Incluye en él las variables de las que depende la consulta,
 *   p. ej. `` `deck:${mode}` `` o `` `match:${matchId}` ``.
 * @param run Consulta a ejecutar.
 */
export function useQuery<T>(key: string, run: () => Promise<T>): QueryState<T> {
  const [nonce, setNonce] = useState(0);
  const [resolved, setResolved] = useState<Resolved<T> | null>(null);

  // Etiqueta de la petición vigente: cambia con `key` o al llamar a `refresh`.
  const requestKey = `${key}#${nonce}`;

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;

    run()
      .then((data) => {
        if (!cancelled) setResolved({ key: requestKey, data, error: null });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setResolved({
          key: requestKey,
          data: null,
          error: cause instanceof Error ? cause : new Error(String(cause)),
        });
      });

    return () => {
      cancelled = true;
    };
    // `run` se re-crea en cada render: la petición la gobierna `requestKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const isCurrent = resolved?.key === requestKey;

  return {
    data: isCurrent ? resolved.data : null,
    loading: !isCurrent,
    error: isCurrent ? resolved.error : null,
    refresh,
  };
}
