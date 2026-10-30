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

import { useCallback, useEffect, useRef, useState } from 'react';

import { PremiumRequiredError, QuotaExceededError, useQuery, useRepositories } from '@/data';
import { usePremium } from '@/features/premium';

import { hasPremiumFilters, withoutPremiumFilters } from './deck-filters';

import type {
  DeckProfile,
  Decision,
  Match,
  ModePreference,
  PremiumQuotas,
  Profile,
  ProfileFilter,
} from '@/data';

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
 * deck.
 *
 * `restored` son los ids de las tarjetas deshechas, con la última arriba: se
 * fijan delante del deck. Mientras el deck no se relea, se enseña la copia que
 * se tenía (`restoredCards`, que puede faltar si la decisión se tomó antes de
 * que esta pantalla se montara). En cuanto llega una lectura nueva
 * (`deck !== restoredBase`) manda ella: la tarjeta se toma de ahí, con su foto
 * renovada. Que no aparezca no prueba nada (el deck es una página de 50): se
 * pregunta por ella aparte, y solo si el servidor ya no la da (`getById` nulo,
 * que es lo que pasa con un bloqueo o un borrado) se retira (`gone`).
 */
interface Session {
  mode: ModePreference;
  decided: DeckProfile[];
  restored: string[];
  restoredCards: DeckProfile[];
  restoredBase: DeckProfile[] | null;
  gone: string[];
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
  return { mode, decided: [], restored: [], restoredCards: [], restoredBase: null, gone: [] };
}

/** La causa de un rechazo de cupo o de Premium, o `null` si es otro fallo. */
function blockedBy(cause: unknown): Exclude<Blocked, null> | null {
  if (cause instanceof QuotaExceededError) return { kind: cause.kind, resetsAt: cause.resetsAt };
  if (cause instanceof PremiumRequiredError) return 'premium';
  return null;
}

/** Sin filtros: constante para no crear un objeto nuevo en cada render. */
const NO_FILTER: ProfileFilter = {};

/** El filtro como texto estable (claves ordenadas): sirve de clave de la consulta. */
function filterSignature(filter: ProfileFilter): string {
  const entries = Object.entries(filter)
    .filter(([, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0))
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return entries.length === 0 ? '' : JSON.stringify(entries);
}

export interface DeckOptions {
  /**
   * El servidor rechazó los filtros premium con `PremiumRequiredError` (Premium
   * caducó con ellos puestos): se llama una vez con el filtro ya limpio para que
   * la pantalla lo aplique, lo que recarga el deck, y avise a la persona.
   */
  onPremiumFiltersRemoved?: (filter: ProfileFilter) => void;
}

export function useDeck(
  mode: ModePreference,
  filter: ProfileFilter = NO_FILTER,
  options?: DeckOptions
): DeckState {
  const repositories = useRepositories();
  const { quotas, refresh: refreshQuotas } = usePremium();
  const signature = filterSignature(filter);
  // Sin filtro la clave sigue siendo `deck:${mode}`, la que releen otras pantallas.
  const deckKey = signature === '' ? `deck:${mode}` : `deck:${mode}:${signature}`;
  const query = useQuery(deckKey, () => repositories.discovery.getDeck({ ...filter, mode }));
  const { refresh } = query;

  // Premium caducado con filtros premium puestos: se quitan y se avisa una vez.
  const onRemoved = useRef(options?.onPremiumFiltersRemoved);
  useEffect(() => {
    onRemoved.current = options?.onPremiumFiltersRemoved;
  });
  const handled = useRef<string | null>(null);
  const rejected = query.error instanceof PremiumRequiredError && hasPremiumFilters(filter);
  useEffect(() => {
    if (!rejected || handled.current === deckKey) return;
    handled.current = deckKey;
    onRemoved.current?.(withoutPremiumFilters(filter));
  }, [rejected, deckKey, filter]);

  // El último deck bueno de este modo: si una relectura falla, `useQuery` suelta
  // el dato, y el deck usable no puede desaparecer por eso. Se ajusta en render
  // (patrón de React para estado derivado), sin un efecto.
  const [kept, setKept] = useState<{ key: string; deck: DeckProfile[] } | null>(null);
  if (query.data !== null && kept?.deck !== query.data) {
    setKept({ key: deckKey, deck: query.data });
  }
  const data = query.data ?? (kept?.key === deckKey ? kept.deck : null);
  const error = query.data === null && data !== null ? null : query.error;
  // Con un deck retenido no se vuelve a cargar: la pantalla desmontaría el
  // stack para enseñar un spinner en cada relectura tras un fallo.
  const loading = data === null && query.loading;

  const [session, setSession] = useState<Session>(emptySession(mode));
  const [match, setMatch] = useState<MatchEvent | null>(null);
  const [failure, setFailure] = useState<Error | null>(null);
  const [blocked, setBlocked] = useState<Blocked>(null);

  // Cambiar de modo relee el deck, así que lo decidido con el modo anterior ya
  // no aplica: se descarta comparando en render, sin un efecto de reinicio.
  const current = session.mode === mode ? session : emptySession(mode);
  const decidedIds = new Set(current.decided.map((profile) => profile.id));
  const freshRead = data !== null && current.restoredBase !== data;
  const pinned = data
    ? current.restored.flatMap((id) => {
        if (current.gone.includes(id)) return [];
        const stale = current.restoredCards.find((profile) => profile.id === id);
        const card = freshRead ? (data.find((profile) => profile.id === id) ?? stale) : stale;
        return card ? [card] : [];
      })
    : [];
  const cards = data
    ? [...pinned, ...data]
        .filter(
          (profile, index, all) => all.findIndex((other) => other.id === profile.id) === index
        )
        .filter((profile) => !decidedIds.has(profile.id))
    : null;

  // Lo último pintado, para los callbacks: así no cierran sobre un deck viejo.
  const latest = useRef<{
    data: DeckProfile[] | null;
    cards: DeckProfile[] | null;
    session: Session;
  }>({ data: null, cards: null, session: current });
  useEffect(() => {
    latest.current = { data, cards, session: current };
  });

  // Tras una lectura nueva, las cartas deshechas que no salen en la página se
  // comprueban una a una: se quedan salvo que el servidor diga que ya no existen
  // para quien mira (bloqueo, borrado). Un fallo de red no es evidencia de nada.
  useEffect(() => {
    if (data === null) return;
    const { session: seen } = latest.current;
    if (seen.restoredBase === data) return;
    const missing = seen.restored.filter(
      (id) =>
        !seen.gone.includes(id) &&
        // Una carta que se ha vuelto a decidir tras deshacer ya no se espera en el deck.
        !seen.decided.some((profile) => profile.id === id) &&
        !data.some((profile) => profile.id === id)
    );
    let cancelled = false;
    for (const id of missing) {
      repositories.profiles.getById(id).then(
        (profile) => {
          if (cancelled) return;
          setSession((previous) => {
            if (previous.mode !== mode) return previous;
            if (profile === null) return { ...previous, gone: [...previous.gone, id] };
            // `getById` no sabe de Super Likes: se conserva lo que ya se sabía de la carta.
            const known = previous.restoredCards.find((other) => other.id === id);
            const card: DeckProfile = { ...profile, superLikedMe: known?.superLikedMe ?? false };
            return {
              ...previous,
              restoredCards: [card, ...previous.restoredCards.filter((other) => other.id !== id)],
            };
          });
        },
        () => {
          // Sin red no se sabe nada: la carta se queda.
        }
      );
    }
    return () => {
      cancelled = true;
    };
  }, [data, mode, repositories]);

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

  const superLike = useCallback(
    (profileId: string) => {
      const profile = latest.current.cards?.find((card) => card.id === profileId);
      if (profile) submit(profile, 'like', { super: true });
    },
    [submit]
  );

  const undo = useCallback(async (): Promise<string | null> => {
    try {
      const id = await repositories.premium.undoLastDecision();
      if (id === null) return null;

      setFailure(null);
      const readNow = latest.current.data;
      setSession((previous) => {
        const base = previous.mode === mode ? previous : emptySession(mode);
        const profile = base.decided.find((other) => other.id === id);
        return {
          ...base,
          decided: base.decided.filter((other) => other.id !== id),
          restored: [id, ...base.restored.filter((other) => other !== id)],
          restoredCards: profile
            ? [profile, ...base.restoredCards.filter((other) => other.id !== id)]
            : base.restoredCards,
          restoredBase: readNow,
        };
      });
      // Se relee el deck: trae la carta si esta sesión no la conocía (la
      // pantalla se remontó dentro de la ventana de deshacer) y renueva la
      // copia de las demás. Si el servidor ya no la devuelve, no se enseña.
      refresh();
      return id;
    } catch (cause) {
      const reason = blockedBy(cause);
      if (reason !== null) setBlocked(reason);
      else setFailure(cause instanceof Error ? cause : new Error(String(cause)));
      return null;
    }
  }, [mode, refresh, repositories]);

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
