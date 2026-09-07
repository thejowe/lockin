/**
 * Interfaces de repositorio.
 *
 * Las pantallas hablan SOLO con estas interfaces, nunca con una implementación
 * concreta. Hoy las cumple el mock en memoria de `src/data/mock/`; mañana las
 * cumplirá el repositorio de Supabase de `src/data/supabase/` sin que ninguna
 * pantalla cambie.
 *
 * Todo es asíncrono aunque el mock resuelva al instante: si la firma fuera
 * síncrona, cambiar a Supabase obligaría a reescribir cada pantalla.
 */

import type {
  Decision,
  DecisionResult,
  MatchWithProfile,
  Message,
  MessageInput,
  ModePreference,
  Profile,
  ProfileFilter,
  ProfileInput,
  Session,
} from './types';

/** Cancela una suscripción. */
export type Unsubscribe = () => void;

/** Quién es el usuario y bajo qué modo navega. */
export interface SessionRepository {
  get(): Promise<Session>;
  /** Guarda el modo elegido en la primera pantalla del onboarding. */
  setActiveMode(mode: ModePreference): Promise<Session>;
  /** Marca qué perfil es el del usuario. Lo llama el repositorio de perfil al guardar. */
  setProfileId(profileId: string | null): Promise<Session>;
  /** `true` cuando hay modo elegido y perfil creado. Decide el arranque de la app. */
  isOnboarded(): Promise<boolean>;
}

/** Fichas de persona: la propia y las de los demás. */
export interface ProfileRepository {
  /** El perfil del usuario, o `null` si aún no lo ha creado. */
  getCurrent(): Promise<Profile | null>;
  /** Crea el perfil propio o actualiza el existente. */
  saveCurrent(input: ProfileInput): Promise<Profile>;
  getById(id: string): Promise<Profile | null>;
  /** Lista perfiles ajenos. Nunca incluye el del usuario actual. */
  list(filter?: ProfileFilter): Promise<Profile[]>;
}

/** El deck de swipe y lo que pasa al soltar una tarjeta. */
export interface DiscoveryRepository {
  /**
   * Perfiles pendientes de decidir, ya filtrados por modo y sin los ya vistos.
   * Decisión de producto: encaje mutuo = dos direcciones con el mismo peso:
   * A = existe intersección entre lo que yo domino y lo que el otro busca;
   * B = existe intersección entre lo que el otro domina y lo que yo busco.
   * Orden descendente por Number(A) + Number(B): mutuo (2), unilateral (1),
   * sin señal (0). No se premia acumular tags ni se exige cubrir toda la lista.
   * Una búsqueda vacía significa apertura, no una coincidencia automática.
   * Sin perfil propio, si cualquiera declara lockin, o si el modo efectivo
   * es lockin, la puntuación es 0. El modo efectivo es el filtro explícito,
   * después el activo de sesión y por último el declarado en el perfil.
   * Empates: id ascendente por orden binario (UUID en Supabase), sin azar ni
   * timestamps. Mismos datos y filtros producen el mismo orden.
   * No se eliminan candidatos por puntuación: también salen los de 0. Cada
   * like/pass persistido los excluye de futuras cargas y deja avanzar al resto.
   * Supabase entrega hasta 50 pendientes por carga; al consumirlos, recargar
   * obtiene los siguientes. El ranking ocurre antes del límite de página.
   * Esto NO condiciona matches: siguen dependiendo solo del like recíproco.
   * Devuelve lista vacía cuando el deck se agota — no es un error.
   */
  getDeck(filter?: ProfileFilter): Promise<Profile[]>;
  /**
   * Registra un swipe. Si el like es recíproco, crea el match y lo devuelve
   * en `match`; en cualquier otro caso `match` es `null`.
   */
  recordDecision(profileId: string, decision: Decision): Promise<DecisionResult>;
  /** Perfiles ya decididos, para excluirlos del deck. */
  listDecided(): Promise<string[]>;
}

/** Matches del usuario actual. */
export interface MatchRepository {
  /** Matches con el perfil del otro lado y el último mensaje ya resueltos. */
  list(): Promise<MatchWithProfile[]>;
  getById(matchId: string): Promise<MatchWithProfile | null>;
  /** Se notifica en cada cambio (match nuevo, mensaje nuevo). */
  subscribe(listener: () => void): Unsubscribe;
}

/** Mensajería 1:1 dentro de un match. */
export interface MessageRepository {
  listByMatch(matchId: string): Promise<Message[]>;
  /** Envía un mensaje como el usuario actual. */
  send(input: MessageInput): Promise<Message>;
  /** Se notifica cuando cambian los mensajes de ese match. */
  subscribe(matchId: string, listener: () => void): Unsubscribe;
}

/**
 * Punto único de acceso a datos. Cualquier implementación (mock, Supabase)
 * debe devolver un objeto con esta forma exacta.
 */
export interface Repositories {
  session: SessionRepository;
  profiles: ProfileRepository;
  discovery: DiscoveryRepository;
  matches: MatchRepository;
  messages: MessageRepository;
}

/** Fábrica de una implementación completa. Lo que exporta cada backend. */
export type RepositoriesFactory = () => Repositories;
