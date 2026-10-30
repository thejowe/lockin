/**
 * Premium en el backend mock: cupos, deshacer, Boost y likes recibidos.
 *
 * Aplica las mismas reglas que el SQL (Tarea 3 del plan de Premium) y en el
 * mismo orden: idempotencia, después cupo y después registro. Todo el tiempo
 * sale del reloj del store (`store.nowMs()`), nunca de `Date.now()` suelto, para
 * que la suite de contrato pueda envejecer likes y Boosts sin esperar.
 */

import {
  ABUSE_LIKES_PER_DAY,
  BOOST_COOLDOWN_DAYS,
  BOOST_MINUTES,
  FREE_LIKES_PER_DAY,
  FREE_SUPERS_PER_WEEK,
  PREMIUM_SUPERS_PER_WEEK,
  UNDO_WINDOW_MINUTES,
} from '../premium-limits';
import { PremiumRequiredError, QuotaExceededError } from '../premium-errors';
import { CURRENT_USER_ID, defaultMockStore } from './store';

import type { MockStore } from './store';
import type { PremiumRepository } from '../repositories';
import type { Decision, IncomingLike, PremiumQuotas, Profile, ProfileFilter } from '../types';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
/** Cuánto dura el Premium que enciende el interruptor de desarrollo. */
const SIMULATED_PREMIUM_MS = 30 * DAY_MS;

const iso = (ms: number): string => new Date(ms).toISOString();

export const premiumTopic = (actorId: string): string => `premium:${actorId}`;

export function isMockPremium(store: MockStore, actorId: string): boolean {
  const until = store.state.premium.get(actorId);
  return until !== undefined && until > store.nowMs();
}

export function requireMockPremium(store: MockStore, actorId: string): void {
  if (!isMockPremium(store, actorId)) throw new PremiumRequiredError();
}

export function notifyQuotas(store: MockStore, actorId: string): void {
  store.notify(premiumTopic(actorId));
}

/** Cuándo se libera el primer hueco de una ventana: el evento más viejo + la ventana. */
function resetOf(events: { atMs: number }[], windowMs: number): string | null {
  if (events.length === 0) return null;
  return iso(Math.min(...events.map((event) => event.atMs)) + windowMs);
}

function quotasOf(store: MockStore, actorId: string): PremiumQuotas {
  const { state } = store;
  const now = store.nowMs();
  const premium = isMockPremium(store, actorId);
  const mine = state.likeEvents.filter((event) => event.actorId === actorId);
  const today = mine.filter((event) => event.atMs > now - DAY_MS);
  const supers = mine.filter((event) => event.kind === 'super' && event.atMs > now - WEEK_MS);
  const superCap = premium ? PREMIUM_SUPERS_PER_WEEK : FREE_SUPERS_PER_WEEK;
  const lastBoost = state.boosts
    .filter((boost) => boost.userId === actorId)
    .reduce<(typeof state.boosts)[number] | null>(
      (latest, boost) => (latest && latest.startsAtMs >= boost.startsAtMs ? latest : boost),
      null
    );
  const cooldownEnd = lastBoost ? lastBoost.startsAtMs + BOOST_COOLDOWN_DAYS * DAY_MS : 0;

  return {
    isPremium: premium,
    premiumUntil: premium ? iso(state.premium.get(actorId) as number) : null,
    likesLeft: premium ? null : Math.max(0, FREE_LIKES_PER_DAY - today.length),
    likesResetAt: resetOf(today, DAY_MS),
    supersLeft: Math.max(0, superCap - supers.length),
    supersResetAt: resetOf(supers, WEEK_MS),
    boostAvailableAt: cooldownEnd > now ? iso(cooldownEnd) : null,
    boostActiveUntil: lastBoost && lastBoost.endsAtMs > now ? iso(lastBoost.endsAtMs) : null,
  };
}

/**
 * Cobra un like (o Super Like): comprueba los cupos y, si pasan, registra el
 * evento. Lanza `QuotaExceededError` sin escribir nada. Es síncrona a propósito:
 * dos llamadas seguidas no se pisan, que es lo que en Postgres hace el cerrojo
 * por actor.
 */
export function chargeLike(
  store: MockStore,
  actorId: string,
  targetId: string,
  isSuper: boolean
): void {
  const quotas = quotasOf(store, actorId);
  const now = store.nowMs();
  const mine = store.state.likeEvents.filter((event) => event.actorId === actorId);
  const today = mine.filter((event) => event.atMs > now - DAY_MS);

  if (today.length >= ABUSE_LIKES_PER_DAY) {
    throw new QuotaExceededError('abuse', resetOf(today, DAY_MS));
  }
  if (!quotas.isPremium && (quotas.likesLeft ?? 0) <= 0) {
    throw new QuotaExceededError('likes', quotas.likesResetAt);
  }
  if (isSuper && quotas.supersLeft <= 0) {
    throw new QuotaExceededError('supers', quotas.supersResetAt);
  }

  store.state.likeEvents.push({ actorId, targetId, kind: isSuper ? 'super' : 'like', atMs: now });
}

/** ¿Pide el filtro algo que solo tiene Premium? La especialidad y el modo no. */
export function usesPremiumFilters(filter: ProfileFilter): boolean {
  return (
    filter.minHoursPerWeek !== undefined ||
    filter.timeBands !== undefined ||
    filter.ambition !== undefined ||
    filter.startingPoint !== undefined ||
    filter.timezoneWindowHours !== undefined
  );
}

/** Horas de desfase de una zona IANA respecto a UTC en ese instante. 0 si no se reconoce. */
function offsetHours(timeZone: string, atMs: number): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).formatToParts(new Date(atMs));
    const part = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
    const wallAsUtc = Date.UTC(
      part('year'),
      part('month') - 1,
      part('day'),
      part('hour'),
      part('minute'),
      part('second')
    );
    return (wallAsUtc - Math.floor(atMs / 1000) * 1000) / HOUR_MS;
  } catch {
    return 0;
  }
}

/** Los filtros premium del deck, contra un candidato. `viewer` es quien mira, si tiene perfil. */
export function matchesPremiumFilters(
  candidate: Profile,
  viewer: Profile | null,
  filter: ProfileFilter,
  nowMs: number
): boolean {
  const { availability } = candidate;
  if (filter.minHoursPerWeek !== undefined && availability.hoursPerWeek < filter.minHoursPerWeek) {
    return false;
  }
  if (
    filter.timeBands?.length &&
    !filter.timeBands.some((band) => availability.bands.includes(band))
  ) {
    return false;
  }
  if (filter.ambition?.length && !filter.ambition.includes(candidate.ambition)) return false;
  if (filter.startingPoint?.length && !filter.startingPoint.includes(candidate.startingPoint)) {
    return false;
  }
  if (filter.timezoneWindowHours !== undefined && viewer) {
    const gap = Math.abs(
      offsetHours(candidate.timezone, nowMs) - offsetHours(viewer.timezone, nowMs)
    );
    if (gap > filter.timezoneWindowHours) return false;
  }
  return true;
}

/** Ids con un Boost en curso ahora mismo. */
export function boostedIds(store: MockStore): Set<string> {
  const now = store.nowMs();
  return new Set(
    store.state.boosts.filter((boost) => boost.endsAtMs > now).map((boost) => boost.userId)
  );
}

/** ¿`candidateId` le dio un Super Like a `actorId`? Solo cuenta mientras el like siga vivo. */
export function superLikedActor(store: MockStore, actorId: string, candidateId: string): boolean {
  const { state } = store;
  if (actorId === CURRENT_USER_ID) {
    if (state.incomingSupers.has(candidateId) && state.incomingLikes.has(candidateId)) return true;
  } else if (candidateId === CURRENT_USER_ID && state.decisions.get(actorId) === 'like') {
    return state.decisionMeta.get(CURRENT_USER_ID)?.get(actorId)?.isSuper === true;
  }
  const theirs = state.actorDecisions.get(candidateId);
  return (
    theirs?.get(actorId) === 'like' &&
    state.decisionMeta.get(candidateId)?.get(actorId)?.isSuper === true
  );
}

export interface MockPremiumDeps {
  /** Las decisiones de este actor (la del usuario de la app o la de un cliente de tests). */
  decisions(): Map<string, Decision>;
  isBlocked(a: string, b: string): boolean;
}

export function createMockPremiumRepository(
  actorId: string,
  store: MockStore,
  deps: MockPremiumDeps
): PremiumRepository {
  const getQuotas = async (): Promise<PremiumQuotas> => quotasOf(store, actorId);

  /** Quién me ha dado like y sigo sin responder, sin bloqueos de por medio. */
  function incoming(): { profile: Profile; isSuper: boolean; atMs: number }[] {
    const { state } = store;
    const likers = new Map<string, { isSuper: boolean; atMs: number }>();
    const nowMs = store.nowMs();

    if (actorId === CURRENT_USER_ID) {
      for (const id of state.incomingLikes) {
        likers.set(id, {
          isSuper: state.incomingSupers.has(id),
          atMs: state.incomingLikeAt.get(id) ?? nowMs,
        });
      }
    } else if (state.decisions.get(actorId) === 'like') {
      const meta = state.decisionMeta.get(CURRENT_USER_ID)?.get(actorId);
      likers.set(CURRENT_USER_ID, { isSuper: meta?.isSuper === true, atMs: meta?.atMs ?? nowMs });
    }
    for (const [other, decisions] of state.actorDecisions) {
      if (other === actorId || decisions.get(actorId) !== 'like') continue;
      const meta = state.decisionMeta.get(other)?.get(actorId);
      likers.set(other, { isSuper: meta?.isSuper === true, atMs: meta?.atMs ?? nowMs });
    }

    const decided = deps.decisions();
    return [...likers.entries()].flatMap(([id, info]) => {
      const profile = state.profiles.get(id);
      if (!profile || id === actorId || decided.has(id) || deps.isBlocked(actorId, id)) return [];
      return [{ profile, ...info }];
    });
  }

  return {
    getQuotas,

    subscribeQuotas(cb) {
      return store.subscribeTo(premiumTopic(actorId), () => {
        void getQuotas().then(cb);
      });
    },

    async undoLastDecision() {
      requireMockPremium(store, actorId);
      const { state } = store;
      const decisions = deps.decisions();
      const meta = state.decisionMeta.get(actorId);
      if (!meta) return null;

      let lastId: string | null = null;
      let lastAt = -Infinity;
      for (const [id, entry] of meta) {
        if (decisions.has(id) && entry.atMs > lastAt) {
          lastId = id;
          lastAt = entry.atMs;
        }
      }
      if (lastId === null) return null;
      if (store.nowMs() - lastAt >= UNDO_WINDOW_MINUTES * MINUTE_MS) return null;

      const target = lastId;
      const madeMatch = state.matches.some(
        (match) => match.profileIds.includes(actorId) && match.profileIds.includes(target)
      );
      if (decisions.get(target) === 'like' && madeMatch) return null;

      // El like gastado (`likeEvents`) no se devuelve: deshacer no borra el registro.
      decisions.delete(target);
      meta.delete(target);
      notifyQuotas(store, actorId);
      return target;
    },

    async activateBoost() {
      requireMockPremium(store, actorId);
      const quotas = quotasOf(store, actorId);
      if (quotas.boostAvailableAt !== null) {
        throw new QuotaExceededError('boost', quotas.boostAvailableAt);
      }
      const startsAtMs = store.nowMs();
      const endsAtMs = startsAtMs + BOOST_MINUTES * MINUTE_MS;
      store.state.boosts.push({ userId: actorId, startsAtMs, endsAtMs });
      notifyQuotas(store, actorId);
      return iso(endsAtMs);
    },

    async countIncomingLikes() {
      return incoming().length;
    },

    async listIncomingLikes(page = {}) {
      requireMockPremium(store, actorId);
      const before = page.before === undefined ? Infinity : Date.parse(page.before);
      const limit = page.limit ?? 50;
      return incoming()
        .filter((entry) => entry.atMs < before)
        .sort(
          (a, b) =>
            Number(b.isSuper) - Number(a.isSuper) ||
            b.atMs - a.atMs ||
            (a.profile.id < b.profile.id ? -1 : 1)
        )
        .slice(0, limit)
        .map((entry): IncomingLike => ({
          profile: entry.profile,
          isSuper: entry.isSuper,
          likedAt: iso(entry.atMs),
        }));
    },

    async syncEntitlement() {
      // Sin tienda de por medio, el mock no tiene nada que releer.
    },
  };
}

/*
 * Ganchos del store por defecto, para el interruptor «Simular Premium» de
 * desarrollo y para el fixture de la suite de contrato. Actúan sobre el usuario
 * de la app (`CURRENT_USER_ID`) y no forman parte de `PremiumRepository`.
 */

/** Enciende o apaga Premium para el usuario de la app. */
export function setMockPremium(active: boolean): void {
  const { state } = defaultMockStore;
  if (active) state.premium.set(CURRENT_USER_ID, defaultMockStore.nowMs() + SIMULATED_PREMIUM_MS);
  else state.premium.delete(CURRENT_USER_ID);
  notifyQuotas(defaultMockStore, CURRENT_USER_ID);
}

/** Siembra `count` likes (o Super Likes) gastados hace `ageHours` horas. */
export function seedMockLikeEvents(kind: 'like' | 'super', count: number, ageHours: number): void {
  const atMs = defaultMockStore.nowMs() - ageHours * HOUR_MS;
  for (let index = 0; index < count; index += 1) {
    defaultMockStore.state.likeEvents.push({
      actorId: CURRENT_USER_ID,
      targetId: `seeded-event-${index}`,
      kind,
      atMs,
    });
  }
  notifyQuotas(defaultMockStore, CURRENT_USER_ID);
}

/** Retrasa `minutes` minutos la última decisión del usuario de la app. */
export function ageMockLastDecision(minutes: number): void {
  const meta = defaultMockStore.state.decisionMeta.get(CURRENT_USER_ID);
  let last: { atMs: number; isSuper: boolean } | null = null;
  for (const entry of meta?.values() ?? []) {
    if (!last || entry.atMs > last.atMs) last = entry;
  }
  if (last) last.atMs -= minutes * MINUTE_MS;
}

/** Crea un Boost ya terminado del usuario de la app, de hace `ageDays` días. */
export function seedMockPastBoost(ageDays: number): void {
  const startsAtMs = defaultMockStore.nowMs() - ageDays * DAY_MS;
  defaultMockStore.state.boosts.push({
    userId: CURRENT_USER_ID,
    startsAtMs,
    endsAtMs: startsAtMs + BOOST_MINUTES * MINUTE_MS,
  });
}

/** `profileId` le da un Super Like al usuario de la app. */
export function mockSuperLikeFrom(profileId: string): void {
  const { state } = defaultMockStore;
  state.incomingLikes.add(profileId);
  state.incomingSupers.add(profileId);
  state.incomingLikeAt.set(profileId, defaultMockStore.nowMs());
}

/** `profileId` hace Premium y tiene un Boost en curso. */
export function mockBoostAs(profileId: string): void {
  const { state } = defaultMockStore;
  const now = defaultMockStore.nowMs();
  state.premium.set(profileId, now + SIMULATED_PREMIUM_MS);
  state.boosts.push({
    userId: profileId,
    startsAtMs: now,
    endsAtMs: now + BOOST_MINUTES * MINUTE_MS,
  });
}
