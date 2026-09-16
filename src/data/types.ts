/**
 * Tipos de dominio de LockIn.
 *
 * Este archivo es el contrato compartido entre bloques (`perfil`, `descubrir`,
 * `chat`, `datos`). Un cambio aquí rompe pantallas de otros bloques: avisa antes
 * de tocarlo. Ver `docs/plan/CONCEPTO.md` para el significado de cada campo.
 *
 * Principio innegociable: nadie contrata a nadie. No añadas campos de sueldo,
 * equity ofrecido ni rol vacante — eso es Modo Talento (Fase 4), fuera del MVP.
 */

/** Los dos modos del MVP. El Modo Talento es Fase 4 y no existe aquí a propósito. */
export type Mode = 'par' | 'lockin';

/** Lo que elige el usuario en el onboarding: un modo concreto o los dos. */
export type ModePreference = Mode | 'ambos';

/** Especialidad declarada en el perfil. */
export type Specialty =
  | 'diseno'
  | 'dev'
  | 'marketing'
  | 'ventas'
  | 'datos'
  | 'legal'
  | 'producto'
  | 'finanzas'
  | 'operaciones'
  | 'contenido';

/** Punto de partida: cuánto tiene construido ya la persona. */
export type StartingPoint =
  /** "Solo tengo ganas y ambición, sin idea todavía". */
  | 'solo-ganas'
  /** "Tengo una idea pero no he empezado nada". */
  | 'idea-sin-empezar'
  /** "Ya toqué algo pequeño, busco con quién llevarlo en serio". */
  | 'algo-empezado';

/** Nivel de ambición declarado, de negocio lifestyle a apostarlo todo. */
export type Ambition = 'lifestyle' | 'equilibrado' | 'todo-o-nada';

/** Franja horaria en la que la persona suele trabajar. */
export type TimeBand = 'madrugada' | 'manana' | 'tarde' | 'noche';

/** Disponibilidad declarada. */
export interface Availability {
  /** Horas por semana que la persona puede dedicar. */
  hoursPerWeek: number;
  /** Franjas en las que suele estar disponible. Al menos una. */
  bands: TimeBand[];
}

/** Enlaces opcionales del perfil. */
export interface ProfileLinks {
  github?: string;
  portfolio?: string;
  linkedin?: string;
}

/**
 * Prueba de que el enlace de GitHub del perfil pertenece a quien controla la
 * cuenta. Se obtiene linkando una identidad OAuth real; el cliente no puede
 * encenderla escribiendo en su propia fila, porque las columnas que la guardan
 * están fuera de su permiso de escritura. Ver
 * `docs/superpowers/specs/2026-09-16-verificacion-github-design.md`.
 *
 * Certifica autoría del enlace y NADA más: ni competencia, ni identidad legal,
 * ni que exista una persona detrás. No la uses como antifraude ni escribas
 * copy que prometa más que eso.
 */
export interface GithubVerification {
  /** El `user_name` de la identidad. `github.com/<handle>` es su perfil. */
  handle: string;
  /** Cuándo se verificó, en ISO. */
  verifiedAt: string;
}

/** Respuesta corta de texto libre, estilo Hinge. Es lo que hace el perfil "swipeable". */
export interface ProfilePrompt {
  /** La pregunta mostrada, p. ej. "Lo que quiero construir es…". */
  question: string;
  /** La respuesta del usuario. Corta a propósito. */
  answer: string;
}

/**
 * Avatar del MVP: iniciales sobre un color derivado del perfil.
 * No hay subida de imágenes en el MVP — no añadas `imageUrl` aquí sin coordinarlo.
 */
export interface Avatar {
  /** 1-2 letras, ya en mayúsculas. */
  initials: string;
  /** Token de acento con el que pintar el fondo. */
  accent: 'brass' | 'teal';
}

/** Ficha de una persona. */
export interface Profile {
  id: string;
  name: string;
  age: number;
  /** Ciudad o zona, en texto libre. */
  location: string;
  /** Identificador IANA, p. ej. `Europe/Madrid`. */
  timezone: string;
  avatar: Avatar;
  /** Lo que esta persona domina y aporta. */
  specialties: Specialty[];
  /**
   * Lo que esta persona quiere que domine la otra: el otro lado de la
   * complementariedad. Simétrico por definición — las dos personas de un match
   * lo declaran, y ninguna «ofrece» nada a la otra. Ojo con el principio
   * innegociable de `CONCEPTO.md`: esto NO es un rol vacante. No lo acompañes
   * nunca de sueldo, equity, seniority ni número de puestos, ni lo renombres a
   * algo tipo `role`/`hiringFor` — eso sería Modo Talento (Fase 4).
   *
   * Vacío significa «me da igual, ábreme a cualquiera», no «no busco a nadie».
   *
   * **Va siempre vacío cuando `lookingFor` es `'lockin'`.** Un compañero de
   * lock-in se elige por franja horaria y compromiso con la sesión, no por
   * skills: no hay nada que complementar cuando cada uno trabaja en lo suyo.
   * Con `'par'` o `'ambos'` puede llevar valores. Quien escribe un perfil
   * (formulario o seed) mantiene esta invariante; el repositorio no la fuerza.
   */
  seekingSpecialties: Specialty[];
  /** Qué busca esta persona: cofundador, compañero de lock-in o ambos. */
  lookingFor: ModePreference;
  startingPoint: StartingPoint;
  availability: Availability;
  ambition: Ambition;
  links: ProfileLinks;
  /**
   * Sello de GitHub, o `null` si esta persona no lo ha verificado.
   *
   * **No está en `ProfileInput` a propósito**: si el formulario pudiera
   * mandarlo, cualquiera se lo encendería. Solo se mueve con `verifyGithub()` y
   * `unverifyGithub()`.
   */
  githubVerification: GithubVerification | null;
  /** 1-2 prompts de texto libre. */
  prompts: ProfilePrompt[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Datos que envía el formulario de perfil. El repositorio pone id y timestamps.
 */
export type ProfileInput = Omit<
  Profile,
  'id' | 'createdAt' | 'updatedAt' | 'avatar' | 'seekingSpecialties' | 'githubVerification'
> & {
  /** Opcional: si no se envía, el repositorio deriva las iniciales del nombre. */
  avatar?: Partial<Avatar>;
  /**
   * Opcional igual que `avatar`, y por el mismo motivo: un formulario que
   * todavía no pregunta por ello no tiene que inventarse un valor. Si no se
   * envía, el repositorio guarda `[]` — que en el dominio significa «abierto a
   * cualquiera», no «dato ausente». Mantiene la invariante de
   * `Profile.seekingSpecialties`: vacío cuando `lookingFor` es `'lockin'`.
   */
  seekingSpecialties?: Specialty[];
};

/** Filtro del deck de descubrimiento. */
export interface ProfileFilter {
  /** Solo perfiles compatibles con este modo. */
  mode?: ModePreference;
  /** Ids a excluir (ya vistos, o el propio usuario). */
  excludeIds?: string[];
  /**
   * Filtra por lo que el perfil **domina** (`Profile.specialties`), no por lo
   * que busca. Un filtro sobre `seekingSpecialties` sería otro campo distinto:
   * no lo metas aquí sin avisar a `descubrir`, que es quien lo consume.
   */
  specialties?: Specialty[];
}

/** Decisión de swipe. */
export type Decision = 'like' | 'pass';

/** Un match entre el usuario actual y otro perfil. */
export interface Match {
  id: string;
  /** Los dos perfiles implicados. El usuario actual siempre está incluido. */
  profileIds: [string, string];
  /** Modo bajo el que se produjo el match. */
  mode: Mode;
  createdAt: string;
  /** Timestamp del último mensaje, o `null` si aún no se ha escrito nada. */
  lastMessageAt: string | null;
}

/** Match ya resuelto con el perfil del otro lado — lo que pintan las pantallas. */
export interface MatchWithProfile extends Match {
  /** El perfil que no es el del usuario actual. */
  counterpart: Profile;
  /** Último mensaje de la conversación, si existe. */
  lastMessage: Message | null;
}

/** Resultado de registrar un swipe. */
export interface DecisionResult {
  decision: Decision;
  /** El match generado, si el like fue recíproco. `null` en cualquier otro caso. */
  match: Match | null;
}

/** Mensaje de una conversación 1:1. */
export interface Message {
  id: string;
  matchId: string;
  /** Id del perfil que envía. */
  senderId: string;
  body: string;
  sentAt: string;
}

/** Datos para enviar un mensaje. El repositorio pone id, emisor y timestamp. */
export interface MessageInput {
  matchId: string;
  body: string;
}

/** Estado de sesión del usuario: quién es y bajo qué modo navega. */
export interface Session {
  /** Id del perfil propio, o `null` si aún no ha completado el onboarding. */
  profileId: string | null;
  /** Modo activo elegido en el onboarding. */
  activeMode: ModePreference | null;
}

/** Bloques de una sesión Lock-In: cada uno son 25 min de trabajo + 5 de descanso. */
export type SessionBlocks = 1 | 2 | 4;

/**
 * Estado guardado de una sesión. "Caducada", "en curso" y "terminada" no están
 * aquí a propósito: se derivan de la hora (ver `src/data/sessions.ts`).
 */
export type SessionStatus = 'propuesta' | 'aceptada' | 'rechazada' | 'cancelada';

/** Sesión Lock-In entre las dos personas de un match. */
export interface LockInSession {
  id: string;
  matchId: string;
  /** Id del perfil que propone. */
  proposedBy: string;
  /** ISO. Inicio del primer bloque. */
  startsAt: string;
  blocks: SessionBlocks;
  status: SessionStatus;
  createdAt: string;
  /** ISO del paso a aceptada/rechazada/cancelada; `null` mientras es propuesta. */
  respondedAt: string | null;
}

/** Asistencia de una persona a una sesión. */
export interface SessionAttendance {
  sessionId: string;
  profileId: string;
  joinedAt: string;
  /**
   * `null` = no salió de forma explícita: se quedó hasta el final o cerró la
   * app. Solo cuenta como abandono un `leftAt` anterior al final de la sesión.
   */
  leftAt: string | null;
}

/** Datos para proponer una sesión. El repositorio pone id, autor y estado. */
export interface SessionProposalInput {
  matchId: string;
  startsAt: string;
  blocks: SessionBlocks;
}

/** Valoración de un toque de una sesión terminada. Privada de quien la escribe. */
export type SessionRating = 'floja' | 'bien' | 'genial';

/**
 * Valoración que una persona dio a una sesión.
 *
 * La lee solo quien la escribió: la otra parte del match no la ve ni por
 * repositorio ni por RLS. No la conviertas en nota pública ni en media sin
 * releer la spec — el principio innegociable de `CONCEPTO.md` es que los dos
 * lados de un match son pares, y una nota visible los vuelve evaluador y
 * evaluado.
 */
export interface SessionRatingEntry {
  sessionId: string;
  /** Quien valora. Siempre el usuario actual: no se leen las de nadie más. */
  profileId: string;
  rating: SessionRating;
  ratedAt: string;
}

/**
 * Racha de una pareja: sesiones compartidas seguidas de la cadena viva.
 *
 * Es del match, no de una persona, y sale solo de sesiones y asistencia —nunca
 * de `session_ratings`—. No la conviertas en racha personal ni la enseñes en
 * perfil o deck sin releer `docs/superpowers/specs/2026-09-15-rachas-design.md`:
 * fuera del match sería reputación.
 */
export interface MatchStreak {
  matchId: string;
  /** Sesiones compartidas seguidas. Siempre ≥ 1: una racha rota no se devuelve. */
  count: number;
  /** ISO. Fin de la última sesión que cuenta + 7 días. */
  aliveUntil: string;
}
