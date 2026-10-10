/**
 * Implementación mock, en memoria, de las interfaces de `src/data/repositories.ts`.
 *
 * Es la implementación activa del MVP. Cuando `datos` conecte Supabase,
 * escribirá otra fábrica con esta misma forma en `src/data/supabase/` y
 * `src/data/index.ts` elegirá entre las dos — las pantallas no se enteran.
 */

import { createMockAgreementRepository } from './agreement';
import {
  CURRENT_USER_ID,
  defaultMockStore,
  initialsFrom,
  isBlockedPair,
  matchesMode,
  nowIso,
  resolveMatchMode,
} from './store';
import { SEED_RECIPROCAL_IDS } from './seed';
import { createMockRoomRepository, roomsTopic } from './rooms';
import { createMockSessionRepository } from './sessions';
import { REPORT_MAX_LENGTH, REPORT_REASONS } from '../types';

import type { MockStore } from './store';

import type {
  DiscoveryRepository,
  MatchRepository,
  MessageRepository,
  ProfileRepository,
  Repositories,
  SessionRepository,
} from '../repositories';
import type {
  Decision,
  DecisionResult,
  Match,
  MatchWithProfile,
  Message,
  MessageInput,
  ModePreference,
  Profile,
  ProfileFilter,
  ProfileInput,
  Session,
} from '../types';

export {
  advanceMockClock,
  createMockStore,
  CURRENT_USER_ID,
  defaultMockStore,
  mockNowMs,
  resetState,
} from './store';
export type { MockStore } from './store';
export { createMockSessionRepository, sessionsTopic } from './sessions';
export type { MockSessionOptions } from './sessions';
export { createMockAgreementRepository } from './agreement';
export { createMockRoomRepository, roomsTopic } from './rooms';
export type { MockRoomOptions } from './rooms';

export interface MockRepositoriesOptions {
  /** Cliente secundario de contrato sobre el mismo almacén. */
  actorId?: string;
  /**
   * Los perfiles de `SEED_RECIPROCAL_IDS` aceptan al instante las sesiones que
   * se les proponen y las salas a las que se les convoca, igual que devuelven
   * el like. Así se puede proponer una
   * sesión «ahora», entrar y llegar a la videollamada sin nadie al otro lado.
   *
   * Por defecto, encendido en la app y apagado bajo Jest: la suite de contrato
   * y los tests de sesión hacen responder a la contraparte a mano, y una
   * propuesta que se acepta sola les quitaría el estado `propuesta`.
   */
  autoAcceptSessions?: boolean;
}

const MATCHES_TOPIC = 'matches';
const messagesTopic = (matchId: string) => `messages:${matchId}`;

/**
 * Construye un juego de repositorios sobre un store.
 *
 * Sin argumento usa `defaultMockStore`, que es lo que hace la app y lo que
 * esperan `resetState()`, `advanceMockClock()` y las suites que las usan. Con un
 * `createMockStore()` propio, dos juegos del mismo proceso no comparten ni
 * datos, ni reloj, ni suscriptores.
 */
export function createMockRepositories(
  store: MockStore = defaultMockStore,
  {
    actorId = CURRENT_USER_ID,
    autoAcceptSessions = process.env.NODE_ENV !== 'test',
  }: MockRepositoriesOptions = {}
): Repositories {
  const getState = () => store.state;
  const createId = (prefix: string) => store.createId(prefix);
  const notify = (topic: string) => store.notify(topic);
  const subscribeTo = (topic: string, listener: () => void) => store.subscribeTo(topic, listener);

  const actorSession = (): Session =>
    actorId === CURRENT_USER_ID
      ? getState().session
      : (getState().actorSessions.get(actorId) ?? { profileId: null, activeMode: null });
  const writeActorSession = (next: Session): void => {
    const state = getState();
    if (actorId === CURRENT_USER_ID) state.session = next;
    else state.actorSessions.set(actorId, next);
  };
  const actorDecisions = (): Map<string, Decision> => {
    if (actorId === CURRENT_USER_ID) return getState().decisions;
    let decisions = getState().actorDecisions.get(actorId);
    if (!decisions) getState().actorDecisions.set(actorId, (decisions = new Map()));
    return decisions;
  };
  const isBlocked = (a: string, b: string): boolean => isBlockedPair(getState(), a, b);
  function checkTarget(profileId: string): void {
    if (profileId === actorId)
      throw Object.assign(new Error('No puedes bloquearte ni reportarte a ti mismo.'), {
        code: 'LI008',
      });
    if (!getState().profiles.has(actorId) || !getState().profiles.has(profileId)) {
      throw Object.assign(new Error('El perfil no está disponible.'), { code: '23503' });
    }
  }

  function currentProfile(): Profile | null {
    const state = getState();
    const { profileId } = actorSession();
    return profileId ? (state.profiles.get(profileId) ?? null) : null;
  }

  /** El modo con el que filtrar: el activo de la sesión, o el declarado en el perfil. */
  function effectiveMode(): ModePreference | undefined {
    return actorSession().activeMode ?? currentProfile()?.lookingFor;
  }

  function lastMessageOf(matchId: string): Message | null {
    const messages = getState().messages.filter((message) => message.matchId === matchId);
    return messages.length > 0 ? messages[messages.length - 1] : null;
  }

  function withCounterpart(match: Match): MatchWithProfile | null {
    const state = getState();
    if (!match.profileIds.includes(actorId) || isBlocked(...match.profileIds)) return null;
    const counterpartId = match.profileIds.find((id) => id !== actorId);
    const counterpart = counterpartId ? state.profiles.get(counterpartId) : undefined;
    if (!counterpart) return null;

    return { ...match, counterpart, lastMessage: lastMessageOf(match.id) };
  }

  const session: SessionRepository = {
    async get(): Promise<Session> {
      return { ...actorSession() };
    },

    async setActiveMode(mode) {
      writeActorSession({ ...actorSession(), activeMode: mode });
      return { ...actorSession() };
    },

    async setProfileId(profileId) {
      writeActorSession({ ...actorSession(), profileId });
      return { ...actorSession() };
    },

    async isOnboarded() {
      const current = actorSession();
      return current.profileId !== null && current.activeMode !== null;
    },

    async deleteMyAccount() {
      // El actor seleccionado, no siempre la cuenta de la app.
      store.deleteUser(actorId);
    },
  };

  const profiles: ProfileRepository = {
    async block(profileId) {
      checkTarget(profileId);
      const blocks = getState().userBlocks.get(actorId) ?? new Set<string>();
      blocks.add(profileId);
      getState().userBlocks.set(actorId, blocks);
      // Espejo de `block_profile`: las filas `invitada`/`aceptada` de la persona
      // bloqueada en las salas de quien bloquea que aún no han empezado pasan a
      // `rechazada`. Las que ya empezaron o se cancelaron no se tocan.
      const nowMs = store.nowMs();
      for (const room of getState().rooms) {
        if (room.hostId !== actorId || room.cancelledAt !== null) continue;
        if (Date.parse(room.startsAt) <= nowMs) continue;
        const members = getState().roomMembers.filter((m) => m.roomId === room.id);
        const swept = members.find(
          (m) => m.profileId === profileId && (m.status === 'invitada' || m.status === 'aceptada')
        );
        if (!swept) continue;
        swept.status = 'rechazada';
        swept.respondedAt = swept.respondedAt ?? new Date(nowMs).toISOString();
        members
          .filter((m) => m.status !== 'rechazada')
          .forEach((m) => notify(roomsTopic(m.profileId)));
      }
      notify(MATCHES_TOPIC);
      // Las salas de quien bloquea y de quien es bloqueado dejan de verse: sus
      // avisos locales y vistas cacheadas se releen, como en Supabase.
      notify(roomsTopic(actorId));
      notify(roomsTopic(profileId));
      for (const match of getState().matches) {
        if (match.profileIds.includes(actorId) && match.profileIds.includes(profileId))
          notify(messagesTopic(match.id));
      }
    },

    async report({ profileId, reason, details }) {
      checkTarget(profileId);
      if (!REPORT_REASONS.includes(reason))
        throw Object.assign(new Error('Elige un motivo válido.'), { code: 'LI009' });
      if (Array.from(details ?? '').length > REPORT_MAX_LENGTH)
        throw Object.assign(new Error('El texto no puede superar 500 caracteres.'), {
          code: '23514',
        });
      getState().userReports.push({
        reporterId: actorId,
        reportedId: profileId,
        reporterRef: actorId,
        reportedRef: profileId,
        createdAtMs: store.nowMs(),
        reason,
        details: details?.trim() || null,
      });
    },
    async getCurrent() {
      return currentProfile();
    },

    async saveCurrent(input: ProfileInput) {
      const state = getState();
      const existing = currentProfile();
      const timestamp = nowIso();

      const profile: Profile = {
        ...input,
        id: existing?.id ?? actorId,
        // Ausente significa «abierto a cualquiera»; ver `ProfileInput` en types.ts.
        seekingSpecialties: input.seekingSpecialties ?? [],
        avatar: {
          initials: input.avatar?.initials ?? initialsFrom(input.name),
          accent: input.avatar?.accent ?? existing?.avatar.accent ?? 'brass',
        },
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        // NO sale de `input` — `ProfileInput` no lo tiene, y ese es el diseño.
        // Se hereda del perfil que ya estaba: editar la ficha no desverifica.
        githubVerification: existing?.githubVerification ?? null,
      };

      state.profiles.set(profile.id, profile);
      if (actorId === CURRENT_USER_ID) state.session = { ...state.session, profileId: profile.id };
      else state.actorSessions.set(actorId, { ...actorSession(), profileId: profile.id });
      notify(MATCHES_TOPIC);

      return profile;
    },

    async getById(id) {
      return getState().profiles.get(id) ?? null;
    },

    async list(filter: ProfileFilter = {}) {
      const excluded = new Set([actorId, ...(filter.excludeIds ?? [])]);

      return [...getState().profiles.values()].filter((profile) => {
        if (excluded.has(profile.id)) return false;
        if (!matchesMode(profile, filter.mode)) return false;
        if (filter.specialties?.length) {
          return filter.specialties.some((specialty) => profile.specialties.includes(specialty));
        }
        return true;
      });
    },

    /**
     * Simulación, NO una verificación. No habla con GitHub: inventa un handle a
     * partir del nombre para que las pantallas tengan los dos estados que pintar
     * sin credenciales. El sello real solo lo puede encender Postgres, en
     * `src/data/supabase/`. Mismo espíritu que el aviso de `store.ts` sobre que
     * el MVP no promete persistencia.
     */
    async verifyGithub() {
      const state = getState();
      const existing = currentProfile();
      if (!existing) throw new Error('No hay perfil que verificar todavía.');

      const handle = existing.name.trim().toLowerCase().split(/\s+/)[0] || 'usuario';
      const profile: Profile = {
        ...existing,
        links: { ...existing.links, github: `https://github.com/${handle}` },
        githubVerification: {
          handle,
          verifiedAt: existing.githubVerification?.verifiedAt ?? nowIso(),
        },
      };

      state.profiles.set(profile.id, profile);
      return profile;
    },

    async unverifyGithub() {
      const state = getState();
      const existing = currentProfile();
      if (!existing) throw new Error('No hay perfil que desverificar todavía.');

      const links = { ...existing.links };
      delete links.github;

      const profile: Profile = { ...existing, links, githubVerification: null };
      state.profiles.set(profile.id, profile);
      return profile;
    },

    /**
     * Devuelve el perfil tal cual. No hay proveedor del que releer nada: el sello
     * del mock se lo inventa `verifyGithub()` a partir del nombre, así que no
     * puede quedarse obsoleto por su cuenta como sí le pasa al de verdad cuando
     * alguien se renombra en GitHub.
     */
    async refreshGithubVerification() {
      const existing = currentProfile();
      if (!existing) throw new Error('No hay perfil que sincronizar todavía.');
      return existing;
    },
  };

  const discovery: DiscoveryRepository = {
    async getDeck(filter: ProfileFilter = {}) {
      const decided = [...actorDecisions().keys()];

      const mode = filter.mode ?? effectiveMode();
      const viewer = currentProfile();
      const candidates = await profiles.list({
        ...filter,
        mode,
        excludeIds: [...decided, ...(filter.excludeIds ?? [])],
      });
      // Espejo del criterio de producto en DiscoveryRepository.getDeck.
      const score = (other: Profile): number => {
        if (
          !viewer ||
          mode === 'lockin' ||
          viewer.lookingFor === 'lockin' ||
          other.lookingFor === 'lockin'
        )
          return 0;
        return (
          Number(viewer.specialties.some((tag) => other.seekingSpecialties.includes(tag))) +
          Number(other.specialties.some((tag) => viewer.seekingSpecialties.includes(tag)))
        );
      };
      return candidates
        .filter((candidate) => !isBlocked(actorId, candidate.id))
        .sort((a, b) => score(b) - score(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    },

    async recordDecision(
      profileId: string,
      decision: Decision,
      mode?: ModePreference
    ): Promise<DecisionResult> {
      const state = getState();
      actorDecisions().set(profileId, decision);

      const other = state.profiles.get(profileId);
      const reverse =
        profileId === CURRENT_USER_ID ? state.decisions : state.actorDecisions.get(profileId);
      const isReciprocal =
        decision === 'like' &&
        (reverse?.get(actorId) === 'like' ||
          (actorId === CURRENT_USER_ID && state.incomingLikes.has(profileId)));
      if (!other || !isReciprocal) return { decision, match: null };
      if (isBlocked(actorId, profileId)) return { decision, match: null };
      const existing = state.matches.find(
        (match) => match.profileIds.includes(actorId) && match.profileIds.includes(profileId)
      );
      if (existing) return { decision, match: existing };

      const match: Match = {
        id: createId('match'),
        profileIds: [actorId, other.id],
        // El modo del deck manda; sin él, el de la sesión. Espejo del
        // `coalesce(p_mode, active_mode, looking_for)` de `record_decision`.
        mode: resolveMatchMode(mode ?? effectiveMode() ?? 'ambos', other.lookingFor),
        createdAt: nowIso(),
        lastMessageAt: null,
      };

      state.matches.push(match);
      notify(MATCHES_TOPIC);

      return { decision, match };
    },

    async listDecided() {
      return [...actorDecisions().keys()];
    },
  };

  const matches: MatchRepository = {
    async list() {
      return getState()
        .matches.map(withCounterpart)
        .filter((match): match is MatchWithProfile => match !== null)
        .sort((a, b) =>
          (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt)
        );
    },

    async getById(matchId) {
      const match = getState().matches.find((candidate) => candidate.id === matchId);
      return match ? withCounterpart(match) : null;
    },

    subscribe(listener) {
      return subscribeTo(MATCHES_TOPIC, listener);
    },
  };

  const messages: MessageRepository = {
    async listByMatch(matchId) {
      const match = getState().matches.find((candidate) => candidate.id === matchId);
      // Mismo bloqueo bilateral que Supabase: tras bloquear, sin historial.
      if (!match?.profileIds.includes(actorId) || isBlocked(...match.profileIds)) return [];
      return getState().messages.filter((message) => message.matchId === matchId);
    },

    async send({ matchId, body }: MessageInput) {
      const state = getState();
      const match = state.matches.find((candidate) => candidate.id === matchId);
      if (!match || !match.profileIds.includes(actorId) || isBlocked(...match.profileIds)) {
        throw Object.assign(new Error('No se puede enviar el mensaje.'), { code: '42501' });
      }
      const message: Message = {
        id: createId('message'),
        matchId,
        senderId: actorId,
        body,
        sentAt: nowIso(),
      };

      state.messages.push(message);

      if (match) match.lastMessageAt = message.sentAt;

      notify(messagesTopic(matchId));
      notify(MATCHES_TOPIC);

      return message;
    },

    subscribe(matchId, listener) {
      return subscribeTo(messagesTopic(matchId), listener);
    },
  };

  return {
    session,
    profiles,
    discovery,
    matches,
    messages,
    sessions: createMockSessionRepository(actorId, store, {
      autoAcceptFrom: autoAcceptSessions ? SEED_RECIPROCAL_IDS : [],
    }),
    agreement: createMockAgreementRepository(actorId, store),
    rooms: createMockRoomRepository(actorId, store, {
      autoAcceptFrom: autoAcceptSessions ? SEED_RECIPROCAL_IDS : [],
    }),
  };
}
