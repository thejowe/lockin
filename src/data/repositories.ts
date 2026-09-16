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
  LockInSession,
  MatchStreak,
  MatchWithProfile,
  Message,
  MessageInput,
  ModePreference,
  Profile,
  ProfileFilter,
  ProfileInput,
  Session,
  SessionAttendance,
  SessionProposalInput,
  SessionRating,
  SessionRatingEntry,
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
  /**
   * Abre el flujo de OAuth de GitHub y, al volver, sincroniza el sello del
   * perfil propio. Devuelve el perfil ya actualizado.
   *
   * **Sobrescribe `links.github`** con la URL derivada de la identidad: quien
   * la llama debe haber avisado al usuario si ya había una distinta.
   *
   * Lanza si el usuario cancela el flujo o si el proveedor lo rechaza.
   */
  verifyGithub(): Promise<Profile>;

  /** Desvincula la identidad, apaga el sello y vacía `links.github`. */
  unverifyGithub(): Promise<Profile>;
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
 * Sesiones Lock-In de los matches del usuario.
 *
 * Reglas, iguales en los dos backends (ver `src/data/sessions.ts`): una sola
 * sesión viva por match; `startsAt` entre ahora + 5 min y ahora + 30 días; solo
 * la otra persona responde a una propuesta; cualquiera cancela antes de empezar;
 * `join` solo en la ventana de entrada, e idempotente; solo se valora una sesión
 * terminada a la que entraron los dos, dentro de las 24 h siguientes, y la
 * valoración es privada de quien la escribe; la racha de un match cuenta
 * sesiones aceptadas con las dos personas dentro, seguidas si entre una y
 * otra hay menos de 7 días, y no lee valoraciones.
 *
 * Errores: `SessionConflictError`, `SessionExpiredError`, `SessionWindowError`,
 * `SessionForbiddenError` (ver `src/data/session-errors.ts`).
 */
export interface LockInSessionRepository {
  /** La sesión viva del match, o `null`. También `null` si el match no es tuyo. */
  getActive(matchId: string): Promise<LockInSession | null>;
  /** `null` si no existe o no es de un match tuyo. */
  getById(sessionId: string): Promise<LockInSession | null>;
  propose(input: SessionProposalInput): Promise<LockInSession>;
  respond(sessionId: string, answer: 'aceptada' | 'rechazada'): Promise<LockInSession>;
  cancel(sessionId: string): Promise<LockInSession>;
  /** Idempotente: si ya había asistencia conserva `joinedAt` y pone `leftAt = null`. */
  join(sessionId: string): Promise<SessionAttendance>;
  leave(sessionId: string): Promise<SessionAttendance>;
  listAttendance(sessionId: string): Promise<SessionAttendance[]>;
  /**
   * La sesión terminada de ese match que toca valorar, o `null`. Es la más
   * reciente que está aceptada, terminada hace menos de 24 h, con las dos
   * personas dentro y todavía sin valorar por ti.
   */
  getRatable(matchId: string): Promise<LockInSession | null>;
  /** Tu valoración de esa sesión, o `null` si no la has valorado. */
  getMyRating(sessionId: string): Promise<SessionRating | null>;
  /** Escribe tu valoración. Repetir el mismo valor es idempotente. */
  rate(sessionId: string, rating: SessionRating): Promise<SessionRatingEntry>;
  /**
   * Rachas vivas de tus matches: una entrada por match con al menos una sesión
   * compartida en la cadena viva. Un match que no aparece no tiene racha.
   */
  listStreaks(): Promise<MatchStreak[]>;
  /** Hora del servidor en ISO, para corregir el reloj del dispositivo. */
  serverNow(): Promise<string>;
  /** Se notifica en cualquier cambio de sesiones o asistencia de ese match. */
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
  sessions: LockInSessionRepository;
}

/** Fábrica de una implementación completa. Lo que exporta cada backend. */
export type RepositoriesFactory = () => Repositories;
