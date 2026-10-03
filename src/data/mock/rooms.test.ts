/**
 * Salas en el mock: lo que el contrato no ve.
 *
 * El comportamiento de producto (el ciego, los errores, los avisos) lo fijan
 * los quince casos de `src/data/repositories.contract.ts`. Aquí solo queda la
 * mecánica propia del mock: las invitadas bot de `autoAcceptFrom` y un perfil
 * que falta en el store. Cada test usa un store propio.
 */

import { CURRENT_USER_ID, createMockRepositories, createMockStore } from './index';
import { createMockRoomRepository, roomsTopic } from './rooms';
import { SEED_RECIPROCAL_IDS } from './seed';
import { buildProfileInput } from '../test-fixtures';

import type { MockStore } from './store';
import type { Repositories } from '../repositories';

const [NURIA, MARC, ALBA] = SEED_RECIPROCAL_IDS;
const MINUTE = 60_000;

let store: MockStore;

/** Lo antes que se puede convocar: la ventana de entrada abre al segundo. */
const soonest = () => new Date(store.nowMs() + 5 * MINUTE + 1_000).toISOString();

async function matchWith(repositories: Repositories, ...ids: string[]): Promise<void> {
  await repositories.profiles.saveCurrent(buildProfileInput());
  for (const id of ids) await repositories.discovery.recordDecision(id, 'like');
}

beforeEach(() => {
  store = createMockStore();
});

describe('con aceptación automática', () => {
  it('las invitadas semilla aceptan al instante y se puede entrar ya', async () => {
    const repositories = createMockRepositories(store, { autoAcceptSessions: true });
    await matchWith(repositories, NURIA, ALBA);

    const view = await repositories.rooms.create({
      inviteeIds: [NURIA, ALBA],
      startsAt: soonest(),
      blocks: 1,
    });

    expect(view.others.map(({ member }) => member.status)).toEqual(['aceptada', 'aceptada']);
    expect(view.others.every(({ member }) => member.respondedAt !== null)).toBe(true);
    store.advanceClock(2_000);
    await expect(repositories.rooms.join(view.room.id)).resolves.toMatchObject({
      profileId: CURRENT_USER_ID,
      leftAt: null,
    });
  });

  it('solo acepta quien está en la lista; las demás siguen invitadas', async () => {
    const repositories = createMockRepositories(store, { autoAcceptSessions: false });
    await matchWith(repositories, NURIA, ALBA);
    const rooms = createMockRoomRepository(CURRENT_USER_ID, store, { autoAcceptFrom: [NURIA] });

    const view = await rooms.create({ inviteeIds: [NURIA, ALBA], startsAt: soonest(), blocks: 1 });

    const statusOf = (id: string) =>
      view.others.find(({ member }) => member.profileId === id)?.member.status;
    expect(statusOf(NURIA)).toBe('aceptada');
    expect(statusOf(ALBA)).toBe('invitada');
  });

  it('bajo Jest, por defecto, nadie acepta solo', async () => {
    const repositories = createMockRepositories(store);
    await matchWith(repositories, NURIA, ALBA);

    const view = await repositories.rooms.create({
      inviteeIds: [NURIA, ALBA],
      startsAt: soonest(),
      blocks: 1,
    });

    expect(view.others.map(({ member }) => member.status)).toEqual(['invitada', 'invitada']);
  });
});

describe('perfiles y avisos', () => {
  it('una persona sin perfil en el store se omite de others sin romper la vista', async () => {
    const repositories = createMockRepositories(store);
    await matchWith(repositories, NURIA, MARC, ALBA);
    const { room } = await repositories.rooms.create({
      inviteeIds: [NURIA, MARC, ALBA],
      startsAt: soonest(),
      blocks: 2,
    });

    store.state.profiles.delete(MARC);

    const view = await repositories.rooms.getById(room.id);
    expect(view?.others.map(({ member }) => member.profileId)).toEqual(
      [NURIA, ALBA].sort((a, b) => (a < b ? -1 : 1))
    );
  });

  it('cada escritura avisa por el tópico de cada participante, no a todo el store', async () => {
    const repositories = createMockRepositories(store);
    await matchWith(repositories, NURIA, ALBA);
    const heard: string[] = [];
    for (const id of [CURRENT_USER_ID, NURIA, ALBA, MARC]) {
      store.subscribeTo(roomsTopic(id), () => heard.push(id));
    }

    await repositories.rooms.create({ inviteeIds: [NURIA, ALBA], startsAt: soonest(), blocks: 1 });

    expect([...heard].sort()).toEqual([CURRENT_USER_ID, NURIA, ALBA].sort());
  });
});
