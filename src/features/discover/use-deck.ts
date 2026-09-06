/**
 * Estado del deck: qué tarjetas quedan y qué pasa al decidir una.
 *
 * La lista se lee una vez por modo y a partir de ahí se consume en local: si
 * cada swipe releyera el repositorio, la pila entera se re-montaría a mitad de
 * animación. La decisión sí se persiste al instante a través de `@/data`.
 *
 * Lo decidido se guarda como ids, no como una copia de la lista: así el deck es
 * siempre una derivada de lo que devolvió el repositorio y no hay dos fuentes
 * de verdad que puedan desincronizarse.
 */

import { useCallback, useState } from 'react';

import { useQuery, useRepositories } from '@/data';

import type { Decision, Match, ModePreference, Profile } from '@/data';

/** Un match recién creado, con el perfil que lo provocó ya resuelto. */
export interface MatchEvent {
  match: Match;
  profile: Profile;
}

/** Ids decididos en esta sesión de swipe, atados al modo con el que se leyó el deck. */
interface DecidedIds {
  mode: ModePreference;
  ids: string[];
}

export interface DeckState {
  /** Tarjetas pendientes, la primera arriba. `null` mientras se carga. */
  cards: Profile[] | null;
  loading: boolean;
  error: Error | null;
  /** Match pendiente de celebrar, o `null`. */
  match: MatchEvent | null;
  decide: (profile: Profile, decision: Decision) => void;
  dismissMatch: () => void;
  refresh: () => void;
}

export function useDeck(mode: ModePreference): DeckState {
  const repositories = useRepositories();
  const { data, loading, error, refresh } = useQuery(`deck:${mode}`, () =>
    repositories.discovery.getDeck({ mode })
  );

  const [decided, setDecided] = useState<DecidedIds>({ mode, ids: [] });
  const [match, setMatch] = useState<MatchEvent | null>(null);
  const [failure, setFailure] = useState<Error | null>(null);

  // Cambiar de modo relee el deck, así que lo decidido con el modo anterior ya
  // no aplica: se descarta comparando en render, sin un efecto de reinicio.
  const decidedIds = decided.mode === mode ? decided.ids : [];
  const cards = data ? data.filter((profile) => !decidedIds.includes(profile.id)) : null;

  const decide = useCallback(
    (profile: Profile, decision: Decision) => {
      setFailure(null);
      // La tarjeta ya ha salido de pantalla: descartarla antes de que responda
      // el repositorio evita un hueco en blanco mientras se resuelve la promesa.
      setDecided((current) =>
        current.mode === mode
          ? { mode, ids: [...current.ids, profile.id] }
          : { mode, ids: [profile.id] }
      );

      repositories.discovery.recordDecision(profile.id, decision).then(
        (result) => {
          if (result.match) setMatch({ match: result.match, profile });
        },
        (cause: unknown) => {
          // Si el swipe no se ha guardado, la tarjeta vuelve al deck: perderla
          // en silencio sería peor que pedir la decisión otra vez.
          setDecided((current) => ({
            mode: current.mode,
            ids: current.ids.filter((id) => id !== profile.id),
          }));
          setFailure(cause instanceof Error ? cause : new Error(String(cause)));
        }
      );
    },
    [mode, repositories]
  );

  const dismissMatch = useCallback(() => setMatch(null), []);

  return {
    cards,
    loading,
    error: error ?? failure,
    match,
    decide,
    dismissMatch,
    refresh,
  };
}
