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

describe('borrar la cuenta de quien convoca', () => {
  /** Una sala futura y otra ya empezada del usuario, y una de Núria con él dentro. */
  async function seed() {
    const repositories = createMockRepositories(store);
    await matchWith(repositories, NURIA, ALBA);
    const future = await repositories.rooms.create({
      inviteeIds: [NURIA, ALBA],
      startsAt: new Date(store.nowMs() + 3 * 60 * MINUTE).toISOString(),
      blocks: 1,
    });
    const started = await repositories.rooms.create({
      inviteeIds: [NURIA, ALBA],
      startsAt: soonest(),
      blocks: 1,
    });
    store.advanceClock(5 * MINUTE + 2_000);
    return { repositories, future: future.room.id, started: started.room.id };
  }

  it('las futuras se cancelan, las empezadas se conservan, y todas pierden el convocante', async () => {
    const { future, started } = await seed();

    store.deleteCurrentUser();

    const byId = (id: string) => store.state.rooms.find((room) => room.id === id);
    expect(byId(future)).toMatchObject({ hostId: null, cancelledAt: expect.any(String) });
    expect(byId(started)).toMatchObject({ hostId: null, cancelledAt: null });
  });

  it('solo cae la fila de miembro de la cuenta borrada; las demás siguen', async () => {
    const { future, started } = await seed();

    store.deleteCurrentUser();

    for (const roomId of [future, started]) {
      const members = store.state.roomMembers
        .filter((member) => member.roomId === roomId)
        .map((member) => member.profileId)
        .sort();
      expect(members).toEqual([NURIA, ALBA].sort());
    }
  });

  it('quienes quedan ven la sala cancelada y nadie manda en una sin convocante', async () => {
    const { future, started } = await seed();
    store.deleteCurrentUser();
    const nuria = createMockRoomRepository(NURIA, store);

    const view = await nuria.getById(future);
    expect(view?.room).toMatchObject({ hostId: null });
    expect(view?.room.cancelledAt).not.toBeNull();
    await expect(nuria.cancel(started)).rejects.toThrow('Solo cancela quien convoca');
  });

  it('una sala ajena donde estaba invitada sigue en pie y conserva a su convocante', async () => {
    const repositories = createMockRepositories(store);
    await matchWith(repositories, NURIA);
    const nuria = createMockRoomRepository(NURIA, store);
    store.state.matches.push({
      id: 'match-nuria-alba',
      profileIds: [NURIA, ALBA],
      mode: 'lockin',
      createdAt: new Date(store.nowMs()).toISOString(),
      lastMessageAt: null,
    });
    const view = await nuria.create({
      inviteeIds: [CURRENT_USER_ID, ALBA],
      startsAt: soonest(),
      blocks: 1,
    });

    store.deleteCurrentUser();

    const room = store.state.rooms.find((candidate) => candidate.id === view.room.id);
    expect(room).toMatchObject({ hostId: NURIA, cancelledAt: null });
    expect(
      store.state.roomMembers.some(
        (member) => member.roomId === view.room.id && member.profileId === CURRENT_USER_ID
      )
    ).toBe(false);
  });
});
