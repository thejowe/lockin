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
import type { ChatScope, PlanItem } from '../chat-plan';
import type {
  BoardPost,
  Decision,
  Group,
  GroupMember,
  GroupMessage,
  GroupRole,
  LockInRoom,
  LockInSession,
  Match,
  Message,
  ModePreference,
  Profile,
  ReportReason,
  RoomMember,
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
  /** Cuándo (reloj del store, en ms) dio like cada perfil de `incomingLikes`. */
  incomingLikeAt: Map<string, number>;
  /** Perfiles de `incomingLikes` cuyo like fue un Super Like. */
  incomingSupers: Set<string>;
  /** Premium por persona: id -> instante (reloj del store, en ms) en que caduca. */
  premium: Map<string, number>;
  /**
   * Registro de likes gastados, solo de inserción (espejo de `like_events`). No
   * se borra al deshacer ni al borrar al perfil destino: el like gastado no se devuelve.
   */
  likeEvents: { actorId: string; targetId: string; kind: 'like' | 'super'; atMs: number }[];
  boosts: { userId: string; startsAtMs: number; endsAtMs: number }[];
  /** Cuándo y cómo se tomó la decisión vigente: actor -> perfil -> metadatos. */
  decisionMeta: Map<string, Map<string, { atMs: number; seq: number; isSuper: boolean }>>;
  /** Contador monotónico de decisiones: ordena las que caen en el mismo milisegundo. */
  decisionSeq: number;
  matches: Match[];
  chatPlan: (PlanItem & { scope: ChatScope; authorId: string })[];
  messages: Message[];
  lockInSessions: LockInSession[];
  attendance: SessionAttendance[];
  /** Valoraciones post-sesión. Cada una la lee solo quien la escribió. */
  ratings: SessionRatingEntry[];
  /** Respuestas del acuerdo de socios. Cada una la ve entera solo quien la escribió. */
  agreementAnswers: StoredAgreementAnswer[];
  /** Matches en los que ya se volcaron las respuestas semilla de la contraparte. */
  agreementSeeded: Set<string>;
  /** Salas Lock-In grupales. */
  rooms: LockInRoom[];
  /** Una fila por persona y sala. Quién ve cuál lo decide `./rooms.ts` (el ciego). */
  roomMembers: RoomMember[];
  /** Estado de clientes secundarios de las pruebas, sin cambiar la sesión de la app. */
  actorSessions: Map<string, Session>;
  actorDecisions: Map<string, Map<string, Decision>>;
  userBlocks: Map<string, Set<string>>;
  /** Aceptaciones de Términos por persona: versión → fecha ISO. */
  termsAcceptances: Map<string, Map<string, string>>;
  /** Tablones personales. En el mock no hay moderación: se publica tal cual. */
  boardPosts: BoardPost[];
  /** Grupos, sus puestos y sus miembros (espejo de `20261109130000_groups.sql`). */
  groups: Group[];
  groupRoles: GroupRole[];
  groupMembers: GroupMember[];
  /** Likes y pases entre personas y grupos. `userId` es siempre la persona candidata. */
  groupSwipes: MockGroupSwipe[];
  groupMessages: GroupMessage[];
  /**
   * Almacén privado; no se expone ningún método de lectura de reportes.
   *
   * Sobreviven al borrado de la cuenta de quien reporta o del reportado (espejo
   * de `20261010120000_reports_retention_and_block_followups.sql`): el id pasa a
   * `null` y la referencia en texto (`*Ref`) se queda. Caducan a los 12 meses de
   * su creación (`purgeOldReports`).
   */
  userReports: {
    reporterId: string | null;
    reportedId: string | null;
    reporterRef: string;
    reportedRef: string;
    createdAtMs: number;
    reason: ReportReason;
    details: string | null;
    /** Solo en reportes de un mensaje: referencia viva, en texto y fragmento. */
    messageId?: string | null;
    messageRef?: string;
    messageExcerpt?: string;
    /** Solo en reportes de un grupo o de un mensaje de su chat. */
    groupId?: string | null;
    groupRef?: string;
    groupName?: string;
  }[];
}

export interface MockGroupSwipe {
  groupId: string;
  userId: string;
  direction: 'user_to_group' | 'group_to_user';
  decision: Decision;
  /** En `group_to_user`, el puesto que cubriría. */
  roleId: string | null;
  actorId: string | null;
}

/**
 * Saca a una persona de un grupo (espejo de `remove_group_member`): libera su
 * plaza, apaga sus likes con ese grupo y aplica la regla de liderazgo —pasa al
 * miembro más antiguo que no administre ya otro grupo; si no queda nadie así,
 * el grupo se borra—. Devuelve si estaba dentro.
 */
export function removeMockGroupMember(state: MockState, userId: string, groupId: string): boolean {
  const membership = state.groupMembers.find(
    (member) => member.userId === userId && member.groupId === groupId
  );
  if (!membership) return false;
  const { roleId } = membership;

  state.groupMembers = state.groupMembers.filter((member) => member !== membership);
  const role = state.groupRoles.find((candidate) => candidate.id === roleId);
  if (role) role.filled = Math.max(role.filled - 1, 0);
  for (const swipe of state.groupSwipes) {
    if (swipe.groupId === groupId && swipe.userId === userId) swipe.decision = 'pass';
  }

  const group = state.groups.find((candidate) => candidate.id === groupId);
  if (group && group.adminId === userId) {
    const adminsElsewhere = new Set(
      state.groups.filter((other) => other.id !== groupId).map((other) => other.adminId)
    );
    const [next] = state.groupMembers
      .filter((member) => member.groupId === groupId && !adminsElsewhere.has(member.userId))
      .sort(
        (a, b) =>
          a.joinedAt.localeCompare(b.joinedAt) ||
          (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0)
      );
    if (next) {
      group.adminId = next.userId;
    } else {
      state.groups = state.groups.filter((candidate) => candidate.id !== groupId);
      state.groupRoles = state.groupRoles.filter((candidate) => candidate.groupId !== groupId);
      state.groupMembers = state.groupMembers.filter((member) => member.groupId !== groupId);
      state.groupSwipes = state.groupSwipes.filter((swipe) => swipe.groupId !== groupId);
      state.groupMessages = state.groupMessages.filter((message) => message.groupId !== groupId);
      state.chatPlan = state.chatPlan.filter(
        (item) => !(item.scope.kind === 'group' && item.scope.id === groupId)
      );
      for (const report of state.userReports) {
        if (report.groupId === groupId) report.groupId = null;
      }
    }
  }
  return true;
}

/**
 * Dos grupos semilla, para que el deck de grupos no nazca vacío sin backend.
 * El primero ya le ha dado like a la cuenta propia para su puesto de
 * desarrollo: si esa persona domina `dev` y le da like, entra en el acto —el
 * mismo truco que `SEED_RECIPROCAL_IDS` en el deck de cofundador—.
 */
function seedGroups(): Pick<MockState, 'groups' | 'groupRoles' | 'groupMembers' | 'groupSwipes'> {
  const createdAt = new Date(Date.now() - 86_400_000).toISOString();
  return {
    groups: [
      {
        id: 'seed-group-taller',
        name: 'Taller Abierto',
        description:
          'Un marketplace para que los talleres pequeños vendan sus piezas sin intermediarios.',
        adminId: 'seed-marc',
        maxMembers: 6,
        createdAt,
      },
      {
        id: 'seed-group-ruta',
        name: 'Ruta Verde',
        description: 'Logística de última milla en bici de carga para comercios de barrio.',
        adminId: 'seed-diego',
        maxMembers: 4,
        createdAt,
      },
    ],
    groupRoles: [
      {
        id: 'seed-role-taller-dev',
        groupId: 'seed-group-taller',
        specialty: 'dev',
        slots: 2,
        filled: 0,
      },
      {
        id: 'seed-role-taller-mkt',
        groupId: 'seed-group-taller',
        specialty: 'marketing',
        slots: 1,
        filled: 1,
      },
      {
        id: 'seed-role-ruta-dev',
        groupId: 'seed-group-ruta',
        specialty: 'dev',
        slots: 1,
        filled: 0,
      },
      {
        id: 'seed-role-ruta-producto',
        groupId: 'seed-group-ruta',
        specialty: 'producto',
        slots: 1,
        filled: 0,
      },
      {
        id: 'seed-role-ruta-diseno',
        groupId: 'seed-group-ruta',
        specialty: 'diseno',
        slots: 1,
        filled: 0,
      },
    ],
    groupMembers: [
      { groupId: 'seed-group-taller', userId: 'seed-marc', roleId: null, joinedAt: createdAt },
      {
        groupId: 'seed-group-taller',
        userId: 'seed-alba',
        roleId: 'seed-role-taller-mkt',
        joinedAt: new Date(Date.now() - 43_200_000).toISOString(),
      },
      { groupId: 'seed-group-ruta', userId: 'seed-diego', roleId: null, joinedAt: createdAt },
    ],
    groupSwipes: [
      {
        groupId: 'seed-group-taller',
        userId: CURRENT_USER_ID,
        direction: 'group_to_user',
        decision: 'like',
        roleId: 'seed-role-taller-dev',
        actorId: 'seed-marc',
      },
    ],
  };
}

function initialState(): MockState {
  return {
    session: { profileId: null, activeMode: null },
    profiles: new Map(SEED_PROFILES.map((profile) => [profile.id, profile])),
    decisions: new Map(),
    incomingLikes: new Set(SEED_RECIPROCAL_IDS),
    // Cada like semilla, un minuto más viejo que el anterior: orden estable.
    incomingLikeAt: new Map(
      SEED_RECIPROCAL_IDS.map((id, index) => [id, Date.now() - (index + 1) * 60_000])
    ),
    incomingSupers: new Set(),
    premium: new Map(),
    likeEvents: [],
    boosts: [],
    decisionMeta: new Map(),
    decisionSeq: 0,
    matches: [],
    chatPlan: [],
    messages: [],
    lockInSessions: [],
    attendance: [],
    ratings: [],
    agreementAnswers: [],
    agreementSeeded: new Set(),
    rooms: [],
    roomMembers: [],
    actorSessions: new Map(),
    actorDecisions: new Map(),
    userBlocks: new Map(),
    termsAcceptances: new Map(),
    boardPosts: [],
    ...seedGroups(),
    groupMessages: [],
    userReports: [],
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
  /**
   * Borra los reportes de más de 12 meses desde su creación, con el reloj del
   * mock (espejo de `purge_old_user_reports()`). Devuelve cuántos borró.
   */
  purgeOldReports(): number;
  /** Elimina la cuenta propia en cascada, conservando los datos ajenos. */
  deleteCurrentUser(): void;
  /** Igual, para cualquier actor del mock (los clientes secundarios de los tests). */
  deleteUser(userId: string): void;
  createId(prefix: string): string;
  subscribeTo(topic: string, listener: () => void): () => void;
  notify(topic: string): void;
}

/**
 * ¿Hay un bloqueo entre las dos personas, en cualquier dirección? Es el espejo de
 * `has_profile_block`: lo comparten el deck, los matches, los mensajes, las
 * sesiones, las salas y el acuerdo del mock.
 */
export function isBlockedPair(state: MockState, a: string, b: string): boolean {
  return Boolean(state.userBlocks.get(a)?.has(b) || state.userBlocks.get(b)?.has(a));
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

    purgeOldReports() {
      // 12 meses atrás ajustando al último día válido (29-feb → 28-feb), como
      // `now() - interval '12 months'` de Postgres: setMonth desbordaría a 1-mar.
      const cutoff = new Date(Date.now() + clockOffsetMs);
      const day = cutoff.getDate();
      cutoff.setDate(1);
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      cutoff.setDate(
        Math.min(day, new Date(cutoff.getFullYear(), cutoff.getMonth() + 1, 0).getDate())
      );
      const before = state.userReports.length;
      state.userReports = state.userReports.filter(
        (report) => report.createdAtMs >= cutoff.getTime()
      );
      return before - state.userReports.length;
    },

    deleteCurrentUser() {
      this.deleteUser(CURRENT_USER_ID);
    },

    deleteUser(userId) {
      const matchIds = new Set(
        state.matches.filter((match) => match.profileIds.includes(userId)).map((match) => match.id)
      );
      const sessionIds = new Set(
        state.lockInSessions
          .filter((session) => matchIds.has(session.matchId) || session.proposedBy === userId)
          .map((session) => session.id)
      );

      state.profiles.delete(userId);
      state.boardPosts = state.boardPosts.filter((post) => post.ownerId !== userId);
      state.actorSessions.delete(userId);
      state.actorDecisions.delete(userId);
      for (const decisions of state.actorDecisions.values()) decisions.delete(userId);
      state.userBlocks.delete(userId);
      state.termsAcceptances.delete(userId);
      state.premium.delete(userId);
      // Los likes gastados que apuntan a esta cuenta se quedan: no se devuelven.
      state.likeEvents = state.likeEvents.filter((event) => event.actorId !== userId);
      state.boosts = state.boosts.filter((boost) => boost.userId !== userId);
      state.decisionMeta.delete(userId);
      for (const meta of state.decisionMeta.values()) meta.delete(userId);
      state.incomingSupers.delete(userId);
      state.incomingLikeAt.delete(userId);
      for (const blocked of state.userBlocks.values()) blocked.delete(userId);
      for (const report of state.userReports) {
        if (report.reporterId === userId) report.reporterId = null;
        if (report.reportedId === userId) report.reportedId = null;
      }
      if (userId === CURRENT_USER_ID) {
        // Estos dos índices contienen solo decisiones de/a la cuenta propia.
        state.decisions.clear();
        state.incomingLikes.clear();
        state.incomingSupers.clear();
        state.incomingLikeAt.clear();
      } else {
        // Lo que la cuenta propia decidió sobre quien se va, o recibió de ella.
        state.decisions.delete(userId);
        state.incomingLikes.delete(userId);
      }
      state.matches = state.matches.filter((match) => !matchIds.has(match.id));
      state.chatPlan = state.chatPlan.filter(
        (item) =>
          item.authorId !== userId && !(item.scope.kind === 'match' && matchIds.has(item.scope.id))
      );
      state.messages = state.messages.filter(
        (message) => !matchIds.has(message.matchId) && message.senderId !== userId
      );
      state.lockInSessions = state.lockInSessions.filter((session) => !sessionIds.has(session.id));
      state.attendance = state.attendance.filter(
        (entry) => !sessionIds.has(entry.sessionId) && entry.profileId !== userId
      );
      state.ratings = state.ratings.filter(
        (entry) => !sessionIds.has(entry.sessionId) && entry.profileId !== userId
      );
      state.agreementAnswers = state.agreementAnswers.filter(
        (entry) => !matchIds.has(entry.matchId) && entry.profileId !== userId
      );
      for (const matchId of matchIds) state.agreementSeeded.delete(matchId);
      // Las salas sobreviven a quien las convocó (espejo de
      // `20261010000100_rooms_survive_host_deletion.sql`): `hostId` pasa a null,
      // las que aún no han empezado se cancelan y las empezadas o terminadas se
      // conservan tal cual. Solo cae la fila de miembro de esta cuenta.
      const nowMs = Date.now() + clockOffsetMs;
      for (const room of state.rooms) {
        if (room.hostId !== userId) continue;
        if (room.cancelledAt === null && Date.parse(room.startsAt) > nowMs) {
          room.cancelledAt = new Date(nowMs).toISOString();
        }
        room.hostId = null;
      }
      state.roomMembers = state.roomMembers.filter((member) => member.profileId !== userId);
      // Grupos: sale del suyo con la regla de liderazgo; caen sus swipes como
      // candidata y sus mensajes. Los swipes que hizo como admin son del grupo.
      const groupIds = [
        ...new Set(
          state.groupMembers
            .filter((member) => member.userId === userId)
            .map((member) => member.groupId)
        ),
      ].sort();
      for (const groupId of groupIds) removeMockGroupMember(state, userId, groupId);
      state.groupSwipes = state.groupSwipes.filter((swipe) => swipe.userId !== userId);
      for (const swipe of state.groupSwipes) {
        if (swipe.actorId === userId) swipe.actorId = null;
      }
      state.groupMessages = state.groupMessages.filter((message) => message.senderId !== userId);
      if (userId === CURRENT_USER_ID) state.session = { profileId: null, activeMode: null };
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
