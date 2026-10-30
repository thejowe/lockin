/**
 * Piezas sueltas del Premium mock que la suite de contrato solo roza.
 *
 * El contrato (`repositories.contract.ts`) prueba el comportamiento visible; aquí
 * se fijan las reglas pequeñas de las que cuelga: qué cuenta como filtro premium,
 * cómo se decide si dos zonas horarias caen dentro de la ventana, en qué orden
 * saltan los cupos y cómo se pagina la lista de likes recibidos.
 */

import { PremiumRequiredError, QuotaExceededError } from '../premium-errors';
import { buildProfile } from '../test-fixtures';
import {
  boostedIds,
  chargeLike,
  createMockPremiumRepository,
  matchesPremiumFilters,
  superLikedActor,
  usesPremiumFilters,
} from './premium';
import { createMockStore, CURRENT_USER_ID } from './store';

import type { Decision } from '../types';

const NOW = Date.parse('2026-10-27T12:00:00Z');

describe('usesPremiumFilters', () => {
  it('ni la especialidad ni el modo son premium', () => {
    expect(usesPremiumFilters({})).toBe(false);
    expect(usesPremiumFilters({ specialties: ['dev'], mode: 'par' })).toBe(false);
  });

  it.each([
    { minHoursPerWeek: 10 },
    { timeBands: ['noche'] },
    { ambition: ['lifestyle'] },
    { startingPoint: ['solo-ganas'] },
    { timezoneWindowHours: 2 },
  ] as const)('%j sí lo es', (filter) => {
    expect(usesPremiumFilters(filter as never)).toBe(true);
  });
});

describe('matchesPremiumFilters', () => {
  const candidate = buildProfile({
    ambition: 'todo-o-nada',
    startingPoint: 'solo-ganas',
    timezone: 'Europe/Madrid',
    availability: { hoursPerWeek: 20, bands: ['noche'] },
  });
  const viewer = buildProfile({ timezone: 'Europe/Madrid' });

  it('sin filtros pasa todo el mundo', () => {
    expect(matchesPremiumFilters(candidate, viewer, {}, NOW)).toBe(true);
  });

  it('descarta a quien dedica menos horas de las pedidas', () => {
    expect(matchesPremiumFilters(candidate, viewer, { minHoursPerWeek: 21 }, NOW)).toBe(false);
    expect(matchesPremiumFilters(candidate, viewer, { minHoursPerWeek: 20 }, NOW)).toBe(true);
  });

  it('pide solape de franjas, no igualdad', () => {
    expect(matchesPremiumFilters(candidate, viewer, { timeBands: ['manana'] }, NOW)).toBe(false);
    expect(matchesPremiumFilters(candidate, viewer, { timeBands: ['manana', 'noche'] }, NOW)).toBe(
      true
    );
    // Una lista vacía no filtra nada.
    expect(matchesPremiumFilters(candidate, viewer, { timeBands: [] }, NOW)).toBe(true);
  });

  it('filtra por ambición y por punto de partida', () => {
    expect(matchesPremiumFilters(candidate, viewer, { ambition: ['lifestyle'] }, NOW)).toBe(false);
    expect(matchesPremiumFilters(candidate, viewer, { ambition: ['todo-o-nada'] }, NOW)).toBe(true);
    expect(
      matchesPremiumFilters(candidate, viewer, { startingPoint: ['idea-sin-empezar'] }, NOW)
    ).toBe(false);
    expect(matchesPremiumFilters(candidate, viewer, { startingPoint: ['solo-ganas'] }, NOW)).toBe(
      true
    );
  });

  describe('ventana de zona horaria', () => {
    const far = buildProfile({ timezone: 'Asia/Tokyo' });
    const near = buildProfile({ timezone: 'Europe/London' });

    it('deja dentro a quien cae en la ventana y fuera a quien no', () => {
      expect(matchesPremiumFilters(far, viewer, { timezoneWindowHours: 2 }, NOW)).toBe(false);
      expect(matchesPremiumFilters(near, viewer, { timezoneWindowHours: 2 }, NOW)).toBe(true);
    });

    it('sin perfil propio no hay con qué comparar y no filtra', () => {
      expect(matchesPremiumFilters(far, null, { timezoneWindowHours: 2 }, NOW)).toBe(true);
    });

    it('una zona que no se reconoce cuenta como UTC en vez de romper', () => {
      const unknown = buildProfile({ timezone: 'No/Existe' });
      expect(matchesPremiumFilters(unknown, near, { timezoneWindowHours: 0 }, NOW)).toBe(true);
    });
  });
});

describe('chargeLike', () => {
  it('sin Premium, el like 26 salta con la hora en que se libera el primero', () => {
    const store = createMockStore();
    for (let index = 0; index < 25; index += 1) {
      store.state.likeEvents.push({
        actorId: CURRENT_USER_ID,
        targetId: `t${index}`,
        kind: 'like',
        atMs: store.nowMs() - 60 * 60_000,
      });
    }

    expect(() => chargeLike(store, CURRENT_USER_ID, 'nuevo', false)).toThrow(QuotaExceededError);
    try {
      chargeLike(store, CURRENT_USER_ID, 'nuevo', false);
    } catch (error) {
      expect((error as QuotaExceededError).kind).toBe('likes');
      expect((error as QuotaExceededError).resetsAt).toEqual(expect.any(String));
    }
  });

  it('el tope antiabuso salta antes que el de likes, también con Premium', () => {
    const store = createMockStore();
    store.state.premium.set(CURRENT_USER_ID, store.nowMs() + 86_400_000);
    for (let index = 0; index < 300; index += 1) {
      store.state.likeEvents.push({
        actorId: CURRENT_USER_ID,
        targetId: `t${index}`,
        kind: 'like',
        atMs: store.nowMs() - 60_000,
      });
    }

    expect(() => chargeLike(store, CURRENT_USER_ID, 'nuevo', false)).toThrow(
      expect.objectContaining({ kind: 'abuse' })
    );
  });

  it('el segundo Super Like de la semana salta aunque queden likes', () => {
    const store = createMockStore();
    chargeLike(store, CURRENT_USER_ID, 'a', true);

    expect(() => chargeLike(store, CURRENT_USER_ID, 'b', true)).toThrow(
      expect.objectContaining({ kind: 'supers' })
    );
    // Y un like normal sigue pasando.
    expect(() => chargeLike(store, CURRENT_USER_ID, 'b', false)).not.toThrow();
  });
});

describe('boostedIds', () => {
  it('cuenta solo los Boost en curso', () => {
    const store = createMockStore();
    const now = store.nowMs();
    store.state.boosts.push(
      { userId: 'activo', startsAtMs: now - 60_000, endsAtMs: now + 60_000 },
      { userId: 'terminado', startsAtMs: now - 120_000, endsAtMs: now - 60_000 }
    );

    expect([...boostedIds(store)]).toEqual(['activo']);
  });
});

describe('superLikedActor', () => {
  it('para la cuenta propia, exige que el Super Like siga vivo', () => {
    const store = createMockStore();
    store.state.incomingSupers.add('ana');

    expect(superLikedActor(store, CURRENT_USER_ID, 'ana')).toBe(false);

    store.state.incomingLikes.add('ana');
    expect(superLikedActor(store, CURRENT_USER_ID, 'ana')).toBe(true);
  });

  it('para otro actor, mira el Super Like que le dio la cuenta propia', () => {
    const store = createMockStore();
    store.state.decisions.set('bot', 'like');
    store.state.decisionMeta.set(
      CURRENT_USER_ID,
      new Map([['bot', { atMs: NOW, seq: 1, isSuper: true }]])
    );

    expect(superLikedActor(store, 'bot', CURRENT_USER_ID)).toBe(true);
  });

  it('entre dos actores ajenos, mira la decisión del candidato', () => {
    const store = createMockStore();
    store.state.actorDecisions.set('c', new Map<string, Decision>([['a', 'like']]));
    store.state.decisionMeta.set('c', new Map([['a', { atMs: NOW, seq: 1, isSuper: true }]]));

    expect(superLikedActor(store, 'a', 'c')).toBe(true);
    expect(superLikedActor(store, 'a', 'otro')).toBe(false);
  });
});

describe('repositorio de Premium', () => {
  function setup(actorId = CURRENT_USER_ID) {
    const store = createMockStore();
    const decisions = new Map<string, Decision>();
    const repository = createMockPremiumRepository(actorId, store, {
      decisions: () => decisions,
      isBlocked: () => false,
    });
    return { store, decisions, repository };
  }

  it('los cupos reflejan la hora en que se libera el siguiente Super Like', async () => {
    const { store, repository } = setup();
    chargeLike(store, CURRENT_USER_ID, 'a', true);

    const quotas = await repository.getQuotas();

    expect(quotas.supersLeft).toBe(0);
    expect(quotas.supersResetAt).toEqual(expect.any(String));
    expect(quotas.likesLeft).toBe(24);
    expect(quotas.boostAvailableAt).toBeNull();
  });

  it('tras un Boost, los cupos dicen hasta cuándo dura y cuándo hay otro', async () => {
    const { store, repository } = setup();
    store.state.premium.set(CURRENT_USER_ID, store.nowMs() + 86_400_000);

    const endsAt = await repository.activateBoost();
    const quotas = await repository.getQuotas();

    expect(quotas.boostActiveUntil).toBe(endsAt);
    expect(quotas.boostAvailableAt).toEqual(expect.any(String));
    expect(quotas.likesLeft).toBeNull();
    expect(quotas.premiumUntil).toEqual(expect.any(String));
  });

  it('sin decisiones, deshacer no devuelve nada', async () => {
    const { store, repository } = setup();
    store.state.premium.set(CURRENT_USER_ID, store.nowMs() + 86_400_000);

    await expect(repository.undoLastDecision()).resolves.toBeNull();
  });

  it('listar likes recibidos exige Premium', async () => {
    const { repository } = setup();

    await expect(repository.listIncomingLikes()).rejects.toBeInstanceOf(PremiumRequiredError);
  });

  describe('likes recibidos', () => {
    function withLikers() {
      const ctx = setup();
      ctx.store.state.premium.set(CURRENT_USER_ID, ctx.store.nowMs() + 86_400_000);
      ctx.store.state.incomingLikes.clear();
      ctx.store.state.incomingLikeAt.clear();
      const base = ctx.store.nowMs();
      ctx.store.state.incomingLikes.add('seed-alba');
      ctx.store.state.incomingLikes.add('seed-diego');
      ctx.store.state.incomingLikes.add('seed-marc');
      ctx.store.state.incomingLikeAt.set('seed-alba', base - 3 * 60_000);
      ctx.store.state.incomingLikeAt.set('seed-diego', base - 2 * 60_000);
      ctx.store.state.incomingLikeAt.set('seed-marc', base - 1 * 60_000);
      return ctx;
    }

    it('ordena por fecha, más reciente primero, y respeta el límite', async () => {
      const { repository } = withLikers();

      const page = await repository.listIncomingLikes({ limit: 2 });

      expect(page.map((entry) => entry.profile.id)).toEqual(['seed-marc', 'seed-diego']);
      expect(page.every((entry) => !entry.isSuper)).toBe(true);
    });

    it('pagina con una marca ISO suelta, por fecha', async () => {
      const { repository } = withLikers();
      const [first] = await repository.listIncomingLikes({ limit: 1 });

      const rest = await repository.listIncomingLikes({ before: first.likedAt });

      expect(rest.map((entry) => entry.profile.id)).toEqual(['seed-diego', 'seed-alba']);
    });

    it('pagina con el cursor completo (Super Like, fecha e id)', async () => {
      const { repository, store } = withLikers();
      store.state.incomingSupers.add('seed-alba');
      const [first, second] = await repository.listIncomingLikes({ limit: 2 });
      expect(first.profile.id).toBe('seed-alba');

      const rest = await repository.listIncomingLikes({
        before: `${second.isSuper ? 1 : 0}|${second.likedAt}|${second.profile.id}`,
      });

      expect(rest.map((entry) => entry.profile.id)).toEqual(['seed-diego']);
    });

    it('si el actor es otro, ve el like que le dio la cuenta propia', async () => {
      const { store, decisions } = setup();
      store.state.profiles.set(CURRENT_USER_ID, buildProfile({ id: CURRENT_USER_ID }));
      const repository = createMockPremiumRepository('bot', store, {
        decisions: () => decisions,
        isBlocked: () => false,
      });
      store.state.decisions.set('bot', 'like');
      store.state.premium.set('bot', store.nowMs() + 86_400_000);

      const list = await repository.listIncomingLikes();

      expect(list.map((entry) => entry.profile.id)).toEqual([CURRENT_USER_ID]);
      await expect(repository.countIncomingLikes()).resolves.toBe(1);
    });
  });

  it('syncEntitlement no hace nada y no falla', async () => {
    const { repository } = setup();

    await expect(repository.syncEntitlement()).resolves.toBeUndefined();
  });

  it('avisa a quien escucha los cupos cuando cambian', async () => {
    const { store, repository } = setup();
    store.state.premium.set(CURRENT_USER_ID, store.nowMs() + 86_400_000);
    const seen: (number | null)[] = [];
    const unsubscribe = repository.subscribeQuotas((quotas) => seen.push(quotas.supersLeft));

    await repository.activateBoost();
    await new Promise((resolve) => setTimeout(resolve, 0));
    unsubscribe();

    expect(seen.length).toBeGreaterThan(0);
  });
});
