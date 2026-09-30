/**
 * Sesión viva en el mock: los perfiles de `SEED_RECIPROCAL_IDS` aceptan al
 * instante lo que se les propone, igual que devuelven el like.
 *
 * Sin esto, en el mock nadie respondía nunca y una sesión se quedaba en
 * «Esperando a…» para siempre: la sala no pasaba de ahí y la videollamada no
 * llegaba a montarse. Cada test usa un store propio para no heredar reloj ni
 * suscriptores de otros.
 */

import { CURRENT_USER_ID, createMockRepositories, createMockStore } from './index';
import { SEED_RECIPROCAL_IDS } from './seed';
import { createMockSessionRepository } from './sessions';

import type { MockStore } from './store';
import type { Repositories } from '../repositories';
import type { LockInSession } from '../types';

const [NURIA] = SEED_RECIPROCAL_IDS;
/** No está en `SEED_RECIPROCAL_IDS`: nunca devuelve el like. */
const DIEGO = 'seed-diego';
const MINUTE = 60_000;

let store: MockStore;

/** Lo antes que se puede proponer: la sala ya está abierta al aceptarse. */
const soonest = () => new Date(store.nowMs() + 5 * MINUTE + 1_000).toISOString();

async function matchWithNuria(repositories: Repositories): Promise<string> {
  const { match } = await repositories.discovery.recordDecision(NURIA, 'like');
  return match!.id;
}

/** Un match con alguien que no es bot. En la app no se da, pero el mock lo admite. */
function matchWithDiego(): string {
  const id = store.createId('match');
  store.state.matches.push({
    id,
    profileIds: [CURRENT_USER_ID, DIEGO],
    mode: 'lockin',
    createdAt: new Date(store.nowMs()).toISOString(),
    lastMessageAt: null,
  });
  return id;
}

beforeEach(() => {
  store = createMockStore();
});

describe('con aceptación automática', () => {
  let repositories: Repositories;

  beforeEach(() => {
    repositories = createMockRepositories(store, { autoAcceptSessions: true });
  });

  it('un perfil recíproco acepta al instante y se puede entrar ya', async () => {
    const matchId = await matchWithNuria(repositories);

    const proposed = await repositories.sessions.propose({
      matchId,
      startsAt: soonest(),
      blocks: 1,
    });

    // Como el backend real: `propose` devuelve la propuesta; la aceptación
    // llega aparte.
    expect(proposed.status).toBe('propuesta');
    const active = await repositories.sessions.getActive(matchId);
    expect(active).toMatchObject({ id: proposed.id, status: 'aceptada' });
    expect(active!.respondedAt).not.toBeNull();

    // La sala abre 5 minutos antes y la propuesta más temprana empieza en
    // 5 min + 1 s: un segundo después ya se entra.
    store.advanceClock(1_000);
    await expect(repositories.sessions.join(proposed.id)).resolves.toMatchObject({
      profileId: CURRENT_USER_ID,
      leftAt: null,
    });
  });

  it('avisa a los suscriptores del match igual que una aceptación real', async () => {
    const matchId = await matchWithNuria(repositories);
    const seen: LockInSession['status'][] = [];
    repositories.sessions.subscribe(matchId, () => {
      const current = store.state.lockInSessions.find((s) => s.matchId === matchId);
      if (current) seen.push(current.status);
    });

    await repositories.sessions.propose({ matchId, startsAt: soonest(), blocks: 1 });

    expect(seen).toEqual(['propuesta', 'aceptada']);
  });

  it('un perfil que no es recíproco no responde', async () => {
    const matchId = matchWithDiego();

    const proposed = await repositories.sessions.propose({
      matchId,
      startsAt: soonest(),
      blocks: 1,
    });

    expect((await repositories.sessions.getById(proposed.id))?.status).toBe('propuesta');
    await expect(repositories.sessions.join(proposed.id)).rejects.toThrow();
  });

  it('lo que propone el perfil recíproco sigue esperando respuesta', async () => {
    const matchId = await matchWithNuria(repositories);

    const theirs = await createMockSessionRepository(NURIA, store).propose({
      matchId,
      startsAt: soonest(),
      blocks: 1,
    });

    expect((await repositories.sessions.getById(theirs.id))?.status).toBe('propuesta');
  });
});

describe('sin aceptación automática', () => {
  it('bajo Jest viene apagada por defecto: la contraparte responde a mano', async () => {
    const repositories = createMockRepositories(store);
    const matchId = await matchWithNuria(repositories);

    const proposed = await repositories.sessions.propose({
      matchId,
      startsAt: soonest(),
      blocks: 1,
    });

    expect((await repositories.sessions.getById(proposed.id))?.status).toBe('propuesta');
    await expect(
      createMockSessionRepository(NURIA, store).respond(proposed.id, 'aceptada')
    ).resolves.toMatchObject({ status: 'aceptada' });
  });

  it('fuera de Jest viene encendida por defecto: es lo que usa la app', async () => {
    const nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    let repositories: Repositories;
    try {
      repositories = createMockRepositories(store);
    } finally {
      process.env.NODE_ENV = nodeEnv;
    }
    const matchId = await matchWithNuria(repositories);

    const proposed = await repositories.sessions.propose({
      matchId,
      startsAt: soonest(),
      blocks: 1,
    });

    expect((await repositories.sessions.getById(proposed.id))?.status).toBe('aceptada');
  });
});
