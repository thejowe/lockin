/**
 * Estado en memoria del backend mock.
 *
 * Vive mientras dura la sesión de la app: al recargar se vuelve a las semillas.
 * Es deliberado — el MVP no promete persistencia; eso llega con Supabase.
 */

import { SEED_PROFILES, SEED_RECIPROCAL_IDS } from './seed';

import type { Decision, Match, Message, ModePreference, Profile, Session } from '../types';

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
}

function initialState(): MockState {
  return {
    session: { profileId: null, activeMode: null },
    profiles: new Map(SEED_PROFILES.map((profile) => [profile.id, profile])),
    decisions: new Map(),
    incomingLikes: new Set(SEED_RECIPROCAL_IDS),
    matches: [],
    messages: [],
  };
}

let state: MockState = initialState();

export function getState(): MockState {
  return state;
}

/** Vuelve al estado semilla. Pensado para tests — no lo llames desde una pantalla. */
export function resetState(): void {
  state = initialState();
  notifyAll();
}

let sequence = 0;

export function createId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Suscripciones por tema. `matches` para la lista de matches,
 * `messages:<matchId>` para una conversación concreta.
 */
const listeners = new Map<string, Set<() => void>>();

export function subscribeTo(topic: string, listener: () => void): () => void {
  const set = listeners.get(topic) ?? new Set();
  set.add(listener);
  listeners.set(topic, set);

  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(topic);
  };
}

export function notify(topic: string): void {
  listeners.get(topic)?.forEach((listener) => listener());
}

function notifyAll(): void {
  listeners.forEach((set) => set.forEach((listener) => listener()));
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
