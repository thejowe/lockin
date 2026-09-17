/**
 * Acceso a los repositorios desde React.
 *
 * `DataProvider` existe para poder inyectar una implementación distinta en tests
 * o en un Storybook sin tocar las pantallas. Sin provider, `useRepositories`
 * devuelve la implementación activa de `src/data/active.ts`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

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
  /** Cierto solo mientras no hay ningún dato: la primera carga de esta `key`. */
  loading: boolean;
  /** Cierto cuando ya hay dato de antes y se está releyendo por encima. */
  refreshing: boolean;
  error: Error | null;
  /** Vuelve a ejecutar la consulta. */
  refresh: () => void;
}

/** Resultado de una petición, con el fallo ya normalizado a `Error`. */
interface Settled<T> {
  data: T | null;
  error: Error | null;
}

/** Lo último resuelto para este componente, etiquetado con su procedencia. */
interface Resolved<T> extends Settled<T> {
  /** Consulta a la que pertenece. Si cambia, el dato ya no sirve. */
  key: string;
  /** Petición concreta: la `key` más el contador de relecturas. */
  requestKey: string;
}

/**
 * Lo que comparten todos los `useQuery` de una misma `key`.
 *
 * Solo vive mientras haya alguien suscrito: al desmontarse el último lector la
 * entrada se borra, así que ni una petición en vuelo ni un contador de
 * relecturas sobreviven a la pantalla que los pidió.
 */
interface QueryEntry {
  /** Relecturas pedidas. Es compartido: un `refresh` relee a todos los lectores. */
  nonce: number;
  listeners: Set<() => void>;
  /** Petición en vuelo, para que dos lectores a la vez no disparen dos lecturas. */
  inFlight: { requestKey: string; settled: Promise<Settled<unknown>> } | null;
}

/**
 * Un registro de entradas por juego de repositorios.
 *
 * La partición importa: dos árboles montados a la vez con `DataProvider`
 * distintos —dos tests, o la app y un Storybook— no pueden compartir una
 * petición en vuelo, porque la misma `key` significa datos distintos en cada
 * uno. El `WeakMap` se vacía solo cuando el juego de repositorios queda sin
 * referencias.
 */
const registries = new WeakMap<Repositories, Map<string, QueryEntry>>();

function registryFor(repositories: Repositories): Map<string, QueryEntry> {
  const existing = registries.get(repositories);
  if (existing) return existing;

  const created = new Map<string, QueryEntry>();
  registries.set(repositories, created);
  return created;
}

function entryFor(registry: Map<string, QueryEntry>, key: string): QueryEntry {
  const existing = registry.get(key);
  if (existing) return existing;

  const created: QueryEntry = { nonce: 0, listeners: new Set(), inFlight: null };
  registry.set(key, created);
  return created;
}

function subscribeToKey(
  registry: Map<string, QueryEntry>,
  key: string,
  onChange: () => void
): () => void {
  const entry = entryFor(registry, key);
  entry.listeners.add(onChange);

  return () => {
    entry.listeners.delete(onChange);
    // Sin lectores no hay a quién servir: la entrada se va con ellos.
    if (entry.listeners.size === 0 && registry.get(key) === entry) registry.delete(key);
  };
}

function nonceFor(registry: Map<string, QueryEntry>, key: string): number {
  return registry.get(key)?.nonce ?? 0;
}

function bumpNonce(registry: Map<string, QueryEntry>, key: string): void {
  const entry = entryFor(registry, key);
  entry.nonce += 1;
  // Copia de la lista: un lector puede desmontarse al enterarse.
  for (const listener of [...entry.listeners]) listener();
}

/**
 * Lanza la petición, o se engancha a la que ya está en vuelo para esta misma
 * `requestKey`. Es lo que evita que `useConversation` y la tarjeta de sesión
 * pidan `profile:current` dos veces al montarse en el mismo commit.
 *
 * La promesa compartida nunca se rechaza: el fallo viaja dentro de `Settled`.
 * Si rechazara, el segundo enganchado dejaría un rechazo sin atender.
 */
function fetchShared<T>(
  registry: Map<string, QueryEntry>,
  key: string,
  requestKey: string,
  run: () => Promise<T>
): Promise<Settled<T>> {
  const entry = entryFor(registry, key);
  if (entry.inFlight?.requestKey === requestKey) {
    return entry.inFlight.settled as Promise<Settled<T>>;
  }

  const settled: Promise<Settled<T>> = run().then(
    (data) => ({ data, error: null }),
    (cause: unknown) => ({
      data: null,
      error: cause instanceof Error ? cause : new Error(String(cause)),
    })
  );

  entry.inFlight = { requestKey, settled: settled as Promise<Settled<unknown>> };
  void settled.then(() => {
    if (entry.inFlight?.requestKey === requestKey) entry.inFlight = null;
  });

  return settled;
}

/**
 * Lee datos de un repositorio dentro de un componente.
 *
 * Retiene el último valor resuelto mientras relee: durante una relectura `data`
 * sigue siendo el dato anterior y `loading` es falso, con `refreshing` cierto
 * para quien quiera enseñar un indicador. Sin eso, cada aviso de realtime
 * vaciaba la pantalla y desmontaba su árbol — en el chat eso cerraba el teclado
 * de Android y tiró un recorrido E2E (run 34160309273).
 *
 * La retención dura solo lo que dura la relectura: en cuanto la consulta
 * resuelve manda lo que traiga, **incluido `null`**. Así un match que de verdad
 * ha desaparecido sigue apareciendo como desaparecido, y solo se tapa el hueco
 * de la relectura. Y solo retiene dentro de la misma `key`: al cambiar `key` la
 * consulta es otra y su dato anterior no dice nada de la nueva.
 *
 * No hace falta ajustar estado durante el render para conseguirlo: lo resuelto
 * se guarda con la etiqueta de su petición y es el render el que decide si
 * sirve, así que no existe el render intermedio con `data: null` — que era
 * justo el que desmontaba el compositor.
 *
 * `refresh` y la petición en vuelo se comparten por `key` entre todos los
 * lectores: pedir la misma `key` dos veces a la vez es una sola lectura, y un
 * `refresh` de cualquiera de ellos relee para todos.
 *
 * @param key Identifica la consulta. Cambiarlo relanza `run`; mantenerlo estable
 *   evita refetches. Incluye en él las variables de las que depende la consulta,
 *   p. ej. `deck:${mode}` o `match:${matchId}`.
 * @param run Consulta a ejecutar.
 */
export function useQuery<T>(key: string, run: () => Promise<T>): QueryState<T> {
  const repositories = useRepositories();
  const registry = useMemo(() => registryFor(repositories), [repositories]);

  const subscribe = useCallback(
    (onChange: () => void) => subscribeToKey(registry, key, onChange),
    [registry, key]
  );
  const readNonce = useCallback(() => nonceFor(registry, key), [registry, key]);
  const nonce = useSyncExternalStore(subscribe, readNonce, readNonce);

  const [resolved, setResolved] = useState<Resolved<T> | null>(null);

  // Etiqueta de la petición vigente: cambia con `key` o al llamar a `refresh`.
  const requestKey = `${key}#${nonce}`;

  const refresh = useCallback(() => bumpNonce(registry, key), [registry, key]);

  useEffect(() => {
    let cancelled = false;

    void fetchShared(registry, key, requestKey, run).then((settled) => {
      if (!cancelled) setResolved({ key, requestKey, ...settled });
    });

    return () => {
      cancelled = true;
    };
    // `run` se re-crea en cada render: la petición la gobierna `requestKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, key, requestKey]);

  // Lo resuelto solo sirve si es de esta misma consulta.
  const forThisKey = resolved?.key === key ? resolved : null;
  // La petición vigente, ya resuelta. Su error es el único que se anuncia: el
  // de una relectura ya superada no se enseña con el dato nuevo delante.
  const current = forThisKey !== null && forThisKey.requestKey === requestKey ? forThisKey : null;
  // Lo que se retiene mientras se relee. Un fallo no deja nada que retener, así
  // que un reintento vuelve a ser una primera carga en vez de enseñar el hueco
  // de la petición que falló.
  const retained = current === null && forThisKey?.error === null ? forThisKey : null;
  const shown = current ?? retained;

  return {
    data: shown === null ? null : shown.data,
    loading: shown === null,
    refreshing: retained !== null,
    error: current?.error ?? null,
    refresh,
  };
}
