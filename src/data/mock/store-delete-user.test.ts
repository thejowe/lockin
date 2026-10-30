/**
 * Borrar una cuenta en el store mock: tiene que llevarse todo lo suyo y dejar
 * intacto lo de los demás.
 *
 * Es el espejo de los `on delete cascade` del esquema (y de las excepciones que
 * el esquema documenta: los likes gastados que apuntan a la cuenta borrada no se
 * devuelven, y las salas sobreviven a quien las convocó). Con colecciones vacías
 * ningún filtro llega a ejecutarse, así que aquí cada una lleva una fila de la
 * cuenta que se va y otra de una persona ajena.
 */

import { createMockStore, CURRENT_USER_ID, mockNowMs } from './store';

import type { MockState } from './store';

const GONE = 'gone-user';
const OTHER = 'other-user';

/** Una fila mínima: los filtros solo miran los campos que el test rellena. */
const row = <T extends object>(fields: T) => fields as never;

function populate(state: MockState) {
  const nowMs = Date.now();
  state.profiles.set(GONE, row({ id: GONE }));
  state.boardPosts.push(
    row({ id: 'bp-gone', ownerId: GONE }),
    row({ id: 'bp-other', ownerId: OTHER })
  );
  state.matches.push(
    row({ id: 'm-gone', profileIds: [GONE, OTHER] }),
    row({ id: 'm-other', profileIds: [OTHER, 'third'] })
  );
  state.messages.push(
    row({ id: 'msg-in-match', matchId: 'm-gone', senderId: OTHER }),
    row({ id: 'msg-by-gone', matchId: 'm-other', senderId: GONE }),
    row({ id: 'msg-other', matchId: 'm-other', senderId: OTHER })
  );
  state.lockInSessions.push(
    row({ id: 's-match', matchId: 'm-gone', proposedBy: OTHER }),
    row({ id: 's-proposed', matchId: 'm-other', proposedBy: GONE }),
    row({ id: 's-other', matchId: 'm-other', proposedBy: OTHER })
  );
  state.attendance.push(
    row({ sessionId: 's-match', profileId: OTHER }),
    row({ sessionId: 's-other', profileId: GONE }),
    row({ sessionId: 's-other', profileId: OTHER })
  );
  state.ratings.push(
    row({ sessionId: 's-proposed', profileId: OTHER }),
    row({ sessionId: 's-other', profileId: GONE }),
    row({ sessionId: 's-other', profileId: OTHER })
  );
  state.agreementAnswers.push(
    row({ matchId: 'm-gone', profileId: OTHER }),
    row({ matchId: 'm-other', profileId: GONE }),
    row({ matchId: 'm-other', profileId: OTHER })
  );
  state.agreementSeeded.add('m-gone');
  state.agreementSeeded.add('m-other');
  state.rooms.push(
    row({
      id: 'r-future',
      hostId: GONE,
      cancelledAt: null,
      startsAt: new Date(nowMs + 3_600_000).toISOString(),
    }),
    row({
      id: 'r-past',
      hostId: GONE,
      cancelledAt: null,
      startsAt: new Date(nowMs - 3_600_000).toISOString(),
    }),
    row({
      id: 'r-other',
      hostId: OTHER,
      cancelledAt: null,
      startsAt: new Date(nowMs + 3_600_000).toISOString(),
    })
  );
  state.roomMembers.push(
    row({ roomId: 'r-other', profileId: GONE }),
    row({ roomId: 'r-other', profileId: OTHER })
  );
  state.userReports.push(
    row({ reporterId: GONE, reportedId: OTHER }),
    row({ reporterId: OTHER, reportedId: GONE })
  );
  state.likeEvents.push(
    row({ actorId: GONE, targetId: OTHER, kind: 'like', atMs: nowMs }),
    row({ actorId: OTHER, targetId: GONE, kind: 'like', atMs: nowMs })
  );
  state.boosts.push(
    row({ userId: GONE, startsAtMs: nowMs, endsAtMs: nowMs }),
    row({ userId: OTHER, startsAtMs: nowMs, endsAtMs: nowMs })
  );
}

describe('deleteUser (store mock)', () => {
  it('se lleva lo de la cuenta borrada y deja lo ajeno', () => {
    const store = createMockStore();
    const { state } = store;
    populate(state);

    store.deleteUser(GONE);

    expect(state.profiles.has(GONE)).toBe(false);
    expect(state.boardPosts.map((post) => post.id)).toEqual(['bp-other']);
    expect(state.matches.map((match) => match.id)).toEqual(['m-other']);
    expect(state.messages.map((message) => message.id)).toEqual(['msg-other']);
    expect(state.lockInSessions.map((session) => session.id)).toEqual(['s-other']);
    expect(state.attendance).toHaveLength(1);
    expect(state.ratings).toHaveLength(1);
    expect(state.agreementAnswers).toHaveLength(1);
    expect([...state.agreementSeeded]).toEqual(['m-other']);
    expect(state.roomMembers.map((member) => member.profileId)).toEqual([OTHER]);
    expect(state.boosts.map((boost) => boost.userId)).toEqual([OTHER]);
    // El like que recibió la cuenta borrada sigue gastado; el que dio, se va con ella.
    expect(state.likeEvents.map((event) => event.actorId)).toEqual([OTHER]);
  });

  it('las salas sobreviven a quien las convocó: sin anfitrión, y canceladas si no habían empezado', () => {
    const store = createMockStore();
    populate(store.state);

    store.deleteUser(GONE);

    const rooms = Object.fromEntries(store.state.rooms.map((room) => [room.id, room]));
    expect(rooms['r-future'].hostId).toBeNull();
    expect(rooms['r-future'].cancelledAt).not.toBeNull();
    expect(rooms['r-past'].hostId).toBeNull();
    expect(rooms['r-past'].cancelledAt).toBeNull();
    expect(rooms['r-other'].hostId).toBe(OTHER);
  });

  it('los reportes se quedan, pero sin la identidad de la cuenta borrada', () => {
    const store = createMockStore();
    populate(store.state);

    store.deleteUser(GONE);

    expect(store.state.userReports).toEqual([
      { reporterId: null, reportedId: OTHER },
      { reporterId: OTHER, reportedId: null },
    ]);
  });

  it('deleteCurrentUser vacía la sesión y los índices de decisiones propias', () => {
    const store = createMockStore();
    store.state.session = { profileId: CURRENT_USER_ID, activeMode: 'par' };
    store.state.decisions.set(OTHER, 'like');

    store.deleteCurrentUser();

    expect(store.state.session).toEqual({ profileId: null, activeMode: null });
    expect(store.state.decisions.size).toBe(0);
    expect(store.state.incomingLikes.size).toBe(0);
  });

  it('reset avisa a quien escucha y deja el estado de fábrica', () => {
    const store = createMockStore();
    const listener = jest.fn();
    store.subscribeTo('cualquiera', listener);
    store.state.premium.set(GONE, 1);

    store.reset();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.state.premium.size).toBe(0);
  });

  it('avisa a quien escuche tras borrar', () => {
    const store = createMockStore();
    const listener = jest.fn();
    store.subscribeTo('cualquiera', listener);

    store.deleteUser(GONE);

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('reloj del store por defecto', () => {
  it('mockNowMs sigue al reloj real mientras nadie lo adelante', () => {
    expect(Math.abs(mockNowMs() - Date.now())).toBeLessThan(5_000);
  });
});
