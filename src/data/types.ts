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
  'id' | 'createdAt' | 'updatedAt' | 'avatar' | 'seekingSpecialties'
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
