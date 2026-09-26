/**
 * Estado en memoria del backend mock.
 *
 * Vive mientras dura la sesión de la app: al recargar se vuelve a las semillas.
 * Es deliberado — el MVP no promete persistencia; eso llega con Supabase.
 *
 * El estado es de un **store**, no del módulo: `createMockStore()` devuelve uno
 * aislado con sus datos, su reloj, su contador de ids y sus suscriptores, y
 * `createMockRepositories(store)` construye sobre él. `defaultMockStore` es el
 * que usa la app y sobre el que operan `resetState()`, `advanceMockClock()` y
 * `mockNowMs()`, que conservan su forma de siempre.
 */

import { SEED_PROFILES, SEED_RECIPROCAL_IDS } from './seed';

import type { StoredAgreementAnswer } from '../agreement';
import type {
  Decision,
  LockInSession,
  Match,
  Message,
  ModePreference,
  Profile,
  Session,
  SessionAttendance,
  SessionRatingEntry,
} from '../types';

/** Id del perfil propio dentro del mock. Estable para que los matches lo referencien. */
export const CURRENT_USER_ID = 'me';

export interface MockState {
  session: Session;
  /** Todos los perfiles, incluido el del usuario una vez creado. */
  profiles: Map<string, Profile>;
  /** Swipes del usuario: id del perfil -> decisión. */
  decisions: Map<string, Decision>;
  /** Perfiles que ya dieron like al usuario. Un like nuestro cierra el match. */
  incomingLikes: Set<string>;
  matches: Match[];
  messages: Message[];
  lockInSessions: LockInSession[];
  attendance: SessionAttendance[];
  /** Valoraciones post-sesión. Cada una la lee solo quien la escribió. */
  ratings: SessionRatingEntry[];
  /** Respuestas del acuerdo de socios. Cada una la ve entera solo quien la escribió. */
  agreementAnswers: StoredAgreementAnswer[];
  /** Matches en los que ya se volcaron las respuestas semilla de la contraparte. */
  agreementSeeded: Set<string>;
}

function initialState(): MockState {
  return {
    session: { profileId: null, activeMode: null },
    profiles: new Map(SEED_PROFILES.map((profile) => [profile.id, profile])),
    decisions: new Map(),
    incomingLikes: new Set(SEED_RECIPROCAL_IDS),
    matches: [],
    messages: [],
    lockInSessions: [],
    attendance: [],
    ratings: [],
    agreementAnswers: [],
    agreementSeeded: new Set(),
  };
}

/**
 * Un juego aislado de estado mock: datos, reloj, contador de ids y
 * suscriptores.
 *
 * Todo esto vivía en variables de módulo, así que dos `createMockRepositories()`
 * del mismo proceso compartían hasta el último `Set` de listeners y no había
 * forma limpia de aislar dos instancias en un test. Ahora el estado es del
 * store, y el store se le pasa a la fábrica.
 */
export interface MockStore {
  /** Los datos. Es un getter: `reset()` sustituye el objeto entero. */
  readonly state: MockState;
  /** Reloj de las sesiones: `Date.now()` más el desfase acumulado. */
  nowMs(): number;
  /** Adelanta el reloj de las sesiones. Solo para tests. */
  advanceClock(ms: number): void;
  /** Vuelve al estado semilla y avisa a todos los suscriptores. */
  reset(): void;
  createId(prefix: string): string;
  subscribeTo(topic: string, listener: () => void): () => void;
  notify(topic: string): void;
}

export function createMockStore(): MockStore {
  let state = initialState();

  /**
   * Reloj de las sesiones. Solo lo usan las sesiones; el resto del mock sigue
   * con `nowIso()`. Existe para que la suite de contrato pueda hacer caducar una
   * propuesta o terminar una sesión sin esperar media hora.
   */
  let clockOffsetMs = 0;
  let sequence = 0;

  /**
   * Suscripciones por tema. `matches` para la lista de matches,
   * `messages:<matchId>` para una conversación concreta.
   */
  const listeners = new Map<string, Set<() => void>>();

  const notify = (topic: string): void => {
    listeners.get(topic)?.forEach((listener) => listener());
  };

  return {
    get state() {
      return state;
    },

    nowMs: () => Date.now() + clockOffsetMs,

    advanceClock(ms) {
      clockOffsetMs += ms;
    },

    reset() {
      state = initialState();
      clockOffsetMs = 0;
      listeners.forEach((set) => set.forEach((listener) => listener()));
    },

    createId(prefix) {
      sequence += 1;
      return `${prefix}-${Date.now().toString(36)}-${sequence}`;
    },

    subscribeTo(topic, listener) {
      const set = listeners.get(topic) ?? new Set<() => void>();
      set.add(listener);
      listeners.set(topic, set);

      return () => {
        set.delete(listener);
        if (set.size === 0) listeners.delete(topic);
      };
    },

    notify,
  };
}

/**
 * El store que usa la app, y el que usan las suites que no piden otro.
 *
 * `resetState()`, `advanceMockClock()` y `mockNowMs()` operan sobre él: son la
 * API que consumen la suite de contrato y las de sesiones, y conservan su forma
 * exacta. Un test que quiera aislamiento pide su propio `createMockStore()` y se
 * lo pasa a `createMockRepositories(store)`.
 */
export const defaultMockStore: MockStore = createMockStore();

export function getState(): MockState {
  return defaultMockStore.state;
}

export function mockNowMs(): number {
  return defaultMockStore.nowMs();
}

/** Adelanta el reloj de las sesiones del store por defecto. Solo para tests. */
export function advanceMockClock(ms: number): void {
  defaultMockStore.advanceClock(ms);
}

/** Vuelve al estado semilla. Pensado para tests — no lo llames desde una pantalla. */
export function resetState(): void {
  defaultMockStore.reset();
}

/**
 * Marca de tiempo de las escrituras del mock.
 *
 * No pasa por el reloj del store a propósito: `advanceClock()` existe para
 * hacer caducar sesiones, y adelantarlo no debería reescribir el `createdAt` de
 * un perfil. Es el comportamiento que ya tenía.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Iniciales a partir del nombre: "Núria Bosch" -> "NB". */
export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const letters = parts.length === 1 ? [parts[0][0]] : [parts[0][0], parts[parts.length - 1][0]];
  return letters.join('').toUpperCase();
}

/** ¿Encaja este perfil con el modo que busca quien mira? */
export function matchesMode(profile: Profile, mode: ModePreference | undefined): boolean {
  if (!mode || mode === 'ambos') return true;
  return profile.lookingFor === 'ambos' || profile.lookingFor === mode;
}

/**
 * Modo bajo el que se produce un match. Si uno de los dos es concreto, manda ese;
 * si ambos dicen "ambos", el match nace en modo Par.
 */
export function resolveMatchMode(a: ModePreference, b: ModePreference): Match['mode'] {
  if (a !== 'ambos') return a;
  if (b !== 'ambos') return b;
  return 'par';
}
