/**
 * Estado del deck: qué tarjetas quedan y qué pasa al decidir una.
 *
 * La lista se lee una vez por modo y a partir de ahí se consume en local: si
 * cada swipe releyera el repositorio, la pila entera se re-montaría a mitad de
 * animación. La decisión sí se persiste al instante a través de `@/data`.
 *
 * El deck es siempre una derivada de lo que devolvió el repositorio menos lo
 * decidido en esta sesión. De lo decidido se guarda la tarjeta entera (no solo
 * el id) únicamente para poder devolverla arriba al deshacer sin releer el deck.
 *
 * Los cupos y Premium no se deciden aquí: el servidor rechaza con
 * `QuotaExceededError` o `PremiumRequiredError`, y el hook solo devuelve la
 * tarjeta a su sitio y deja la causa en `blocked` para que la pantalla abra la
 * hoja. Un cupo agotado no es un error de guardado.
 */

import { useCallback, useState } from 'react';

import { PremiumRequiredError, QuotaExceededError, useQuery, useRepositories } from '@/data';
import { usePremium } from '@/features/premium';

import type { DeckProfile, Decision, Match, ModePreference, PremiumQuotas, Profile } from '@/data';

/** Un match recién creado, con el perfil que lo provocó ya resuelto. */
export interface MatchEvent {
  match: Match;
  profile: Profile;
}

/**
 * Qué ha frenado una decisión: un cupo agotado (con la hora a la que se libera,
 * la del servidor) o la falta de Premium. `null`: nada.
 */
export type Blocked =
  { kind: QuotaExceededError['kind']; resetsAt: string | null } | 'premium' | null;

/**
 * Lo decidido en esta sesión de swipe, atado al modo con el que se leyó el
 * deck. `restored` son las tarjetas deshechas, con la última arriba.
 */
interface Session {
  mode: ModePreference;
  decided: DeckProfile[];
  restored: DeckProfile[];
}

export interface DeckState {
  /** Tarjetas pendientes, la primera arriba. `null` mientras se carga. */
  cards: DeckProfile[] | null;
  loading: boolean;
  error: Error | null;
  /** Match pendiente de celebrar, o `null`. */
  match: MatchEvent | null;
  /** Cupo agotado o Premium requerido: la hoja «sin likes». `null`, cerrada. */
  blocked: Blocked;
  /** Los cupos vigentes, o `null` mientras se leen. */
  quotas: PremiumQuotas | null;
  decide: (profile: Profile, decision: Decision) => void;
  /** Like con Super Like sobre una tarjeta del deck. */
  superLike: (profileId: string) => void;
  /** Deshace la última decisión y devuelve la tarjeta arriba. `null` si no había nada o falta Premium. */
  undo: () => Promise<string | null>;
  /** Activa el Boost. Devuelve cuándo termina, o `null` si no se pudo (la hoja explica por qué). */
  boost: () => Promise<string | null>;
  /**
   * El gesto a la derecha con el cupo agotado: relee los cupos y, si de verdad
   * siguen a cero, abre la hoja. Si ya se han liberado, no hace nada.
   */
  checkLikeLimit: () => Promise<void>;
  dismissBlocked: () => void;
  dismissMatch: () => void;
  refresh: () => void;
}

function emptySession(mode: ModePreference): Session {
  return { mode, decided: [], restored: [] };
}

/** La causa de un rechazo de cupo o de Premium, o `null` si es otro fallo. */
function blockedBy(cause: unknown): Exclude<Blocked, null> | null {
  if (cause instanceof QuotaExceededError) return { kind: cause.kind, resetsAt: cause.resetsAt };
  if (cause instanceof PremiumRequiredError) return 'premium';
  return null;
}

export function useDeck(mode: ModePreference): DeckState {
  const repositories = useRepositories();
  const { quotas, refresh: refreshQuotas } = usePremium();
  const { data, loading, error, refresh } = useQuery(`deck:${mode}`, () =>
    repositories.discovery.getDeck({ mode })
  );

  const [session, setSession] = useState<Session>(emptySession(mode));
  const [match, setMatch] = useState<MatchEvent | null>(null);
  const [failure, setFailure] = useState<Error | null>(null);
  const [blocked, setBlocked] = useState<Blocked>(null);

  // Cambiar de modo relee el deck, así que lo decidido con el modo anterior ya
  // no aplica: se descarta comparando en render, sin un efecto de reinicio.
  const current = session.mode === mode ? session : emptySession(mode);
  const decidedIds = new Set(current.decided.map((profile) => profile.id));
  const cards = data
    ? [...current.restored, ...data]
        .filter(
          (profile, index, all) => all.findIndex((other) => other.id === profile.id) === index
        )
        .filter((profile) => !decidedIds.has(profile.id))
    : null;

  const submit = useCallback(
    (profile: DeckProfile, decision: Decision, options?: { super?: boolean }) => {
      setFailure(null);
      // La tarjeta ya ha salido de pantalla: descartarla antes de que responda
      // el repositorio evita un hueco en blanco mientras se resuelve la promesa.
      setSession((previous) => {
        const base = previous.mode === mode ? previous : emptySession(mode);
        return { ...base, decided: [...base.decided, profile] };
      });

      // El modo del deck viaja con la decisión: es el del chip, que puede no
      // ser el activo de la sesión, y el match tiene que nacer en él.
      const saved = options
        ? repositories.discovery.recordDecision(profile.id, decision, mode, options)
        : repositories.discovery.recordDecision(profile.id, decision, mode);

      saved.then(
        (result) => {
          if (result.match) setMatch({ match: result.match, profile });
        },
        (cause: unknown) => {
          // Si el swipe no se ha guardado, la tarjeta vuelve al deck: perderla
          // en silencio sería peor que pedir la decisión otra vez.
          setSession((previous) => ({
            ...previous,
            decided: previous.decided.filter((other) => other.id !== profile.id),
          }));
          const reason = blockedBy(cause);
          if (reason !== null) setBlocked(reason);
          else setFailure(cause instanceof Error ? cause : new Error(String(cause)));
        }
      );
    },
    [mode, repositories]
  );

  const decide = useCallback(
    (profile: Profile, decision: Decision) => submit(profile as DeckProfile, decision),
    [submit]
  );

  const topIds = cards?.map((card) => card.id).join(',');
  const superLike = useCallback(
    (profileId: string) => {
      const profile = cards?.find((card) => card.id === profileId);
      if (profile) submit(profile, 'like', { super: true });
    },
    // `cards` se recalcula en cada render: su contenido lo resume `topIds`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topIds, submit]
  );

  const undo = useCallback(async (): Promise<string | null> => {
    try {
      const id = await repositories.premium.undoLastDecision();
      if (id === null) return null;

      setFailure(null);
      setSession((previous) => {
        const base = previous.mode === mode ? previous : emptySession(mode);
        const profile = base.decided.find((other) => other.id === id);
        return {
          ...base,
          decided: base.decided.filter((other) => other.id !== id),
          restored: profile
            ? [profile, ...base.restored.filter((other) => other.id !== id)]
            : base.restored,
        };
      });
      return id;
    } catch (cause) {
      const reason = blockedBy(cause);
      if (reason !== null) setBlocked(reason);
      else setFailure(cause instanceof Error ? cause : new Error(String(cause)));
      return null;
    }
  }, [mode, repositories]);

  const boost = useCallback(async (): Promise<string | null> => {
    try {
      return await repositories.premium.activateBoost();
    } catch (cause) {
      const reason = blockedBy(cause);
      if (reason !== null) setBlocked(reason);
      else setFailure(cause instanceof Error ? cause : new Error(String(cause)));
      return null;
    }
  }, [repositories]);

  const checkLikeLimit = useCallback(async () => {
    try {
      const fresh = await repositories.premium.getQuotas();
      void refreshQuotas();
      if (!fresh.isPremium && fresh.likesLeft === 0) {
        setBlocked({ kind: 'likes', resetsAt: fresh.likesResetAt });
      }
    } catch {
      // Sin poder leer los cupos no se bloquea nada: decide el servidor al guardar.
    }
  }, [refreshQuotas, repositories]);

  const dismissBlocked = useCallback(() => setBlocked(null), []);
  const dismissMatch = useCallback(() => setMatch(null), []);

  return {
    cards,
    loading,
    error: error ?? failure,
    match,
    blocked,
    quotas,
    decide,
    superLike,
    undo,
    boost,
    checkLikeLimit,
    dismissBlocked,
    dismissMatch,
    refresh,
  };
}
