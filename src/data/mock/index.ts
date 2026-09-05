/**
 * Implementación mock, en memoria, de las interfaces de `src/data/repositories.ts`.
 *
 * Es la implementación activa del MVP. Cuando `datos` conecte Supabase,
 * escribirá otra fábrica con esta misma forma en `src/data/supabase/` y
 * `src/data/index.ts` elegirá entre las dos — las pantallas no se enteran.
 */

import {
  CURRENT_USER_ID,
  createId,
  getState,
  initialsFrom,
  matchesMode,
  notify,
  nowIso,
  resolveMatchMode,
  subscribeTo,
} from './store';

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

export { CURRENT_USER_ID, resetState } from './store';

const MATCHES_TOPIC = 'matches';
const messagesTopic = (matchId: string) => `messages:${matchId}`;

function currentProfile(): Profile | null {
  const state = getState();
  return state.session.profileId ? (state.profiles.get(state.session.profileId) ?? null) : null;
}

/** El modo con el que filtrar: el activo de la sesión, o el declarado en el perfil. */
function effectiveMode(): ModePreference | undefined {
  const state = getState();
  return state.session.activeMode ?? currentProfile()?.lookingFor;
}

function lastMessageOf(matchId: string): Message | null {
  const messages = getState().messages.filter((message) => message.matchId === matchId);
  return messages.length > 0 ? messages[messages.length - 1] : null;
}

function withCounterpart(match: Match): MatchWithProfile | null {
  const state = getState();
  const counterpartId = match.profileIds.find((id) => id !== CURRENT_USER_ID);
  const counterpart = counterpartId ? state.profiles.get(counterpartId) : undefined;
  if (!counterpart) return null;

  return { ...match, counterpart, lastMessage: lastMessageOf(match.id) };
}

const session: SessionRepository = {
  async get(): Promise<Session> {
    return { ...getState().session };
  },

  async setActiveMode(mode) {
    const state = getState();
    state.session = { ...state.session, activeMode: mode };
    return { ...state.session };
  },

  async setProfileId(profileId) {
    const state = getState();
    state.session = { ...state.session, profileId };
    return { ...state.session };
  },

  async isOnboarded() {
    const { session: current } = getState();
    return current.profileId !== null && current.activeMode !== null;
  },
};

const profiles: ProfileRepository = {
  async getCurrent() {
    return currentProfile();
  },

  async saveCurrent(input: ProfileInput) {
    const state = getState();
    const existing = currentProfile();
    const timestamp = nowIso();

    const profile: Profile = {
      ...input,
      id: existing?.id ?? CURRENT_USER_ID,
      avatar: {
        initials: input.avatar?.initials ?? initialsFrom(input.name),
        accent: input.avatar?.accent ?? existing?.avatar.accent ?? 'brass',
      },
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    state.profiles.set(profile.id, profile);
    state.session = { ...state.session, profileId: profile.id };
    notify(MATCHES_TOPIC);

    return profile;
  },

  async getById(id) {
    return getState().profiles.get(id) ?? null;
  },

  async list(filter: ProfileFilter = {}) {
    const excluded = new Set([CURRENT_USER_ID, ...(filter.excludeIds ?? [])]);

    return [...getState().profiles.values()].filter((profile) => {
      if (excluded.has(profile.id)) return false;
      if (!matchesMode(profile, filter.mode)) return false;
      if (filter.specialties?.length) {
        return filter.specialties.some((specialty) => profile.specialties.includes(specialty));
      }
      return true;
    });
  },
};

const discovery: DiscoveryRepository = {
  async getDeck(filter: ProfileFilter = {}) {
    const decided = [...getState().decisions.keys()];

    return profiles.list({
      ...filter,
      mode: filter.mode ?? effectiveMode(),
      excludeIds: [...decided, ...(filter.excludeIds ?? [])],
    });
  },

  async recordDecision(profileId: string, decision: Decision): Promise<DecisionResult> {
    const state = getState();
    state.decisions.set(profileId, decision);

    const other = state.profiles.get(profileId);
    const isReciprocal = decision === 'like' && state.incomingLikes.has(profileId);
    if (!other || !isReciprocal) return { decision, match: null };

    const match: Match = {
      id: createId('match'),
      profileIds: [CURRENT_USER_ID, other.id],
      mode: resolveMatchMode(effectiveMode() ?? 'ambos', other.lookingFor),
      createdAt: nowIso(),
      lastMessageAt: null,
    };

    state.matches.push(match);
    notify(MATCHES_TOPIC);

    return { decision, match };
  },

  async listDecided() {
    return [...getState().decisions.keys()];
  },
};

const matches: MatchRepository = {
  async list() {
    return getState()
      .matches.map(withCounterpart)
      .filter((match): match is MatchWithProfile => match !== null)
      .sort((a, b) => (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt));
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
    return getState().messages.filter((message) => message.matchId === matchId);
  },

  async send({ matchId, body }: MessageInput) {
    const state = getState();
    const message: Message = {
      id: createId('message'),
      matchId,
      senderId: CURRENT_USER_ID,
      body,
      sentAt: nowIso(),
    };

    state.messages.push(message);

    const match = state.matches.find((candidate) => candidate.id === matchId);
    if (match) match.lastMessageAt = message.sentAt;

    notify(messagesTopic(matchId));
    notify(MATCHES_TOPIC);

    return message;
  },

  subscribe(matchId, listener) {
    return subscribeTo(messagesTopic(matchId), listener);
  },
};

export function createMockRepositories(): Repositories {
  return { session, profiles, discovery, matches, messages };
}
