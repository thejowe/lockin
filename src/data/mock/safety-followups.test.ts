/**
 * Cabos sueltos de bloquear/reportar en el mock: espejo de
 * `supabase/migrations/20261010120000_reports_retention_and_block_followups.sql`.
 *
 * El comportamiento visible por dos clientes (dos invitadas bloqueadas entre sí
 * no se ven) lo fija el contrato compartido; aquí solo lo que necesita el
 * almacén por dentro: la instantánea del reporte, su caducidad y el barrido de
 * filas de sala.
 */

import { CURRENT_USER_ID, createMockRepositories, createMockStore } from './index';
import { SEED_RECIPROCAL_IDS } from './seed';
import { buildProfileInput } from '../test-fixtures';

import type { MockStore } from './store';

const [NURIA, , ALBA] = SEED_RECIPROCAL_IDS;
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

let store: MockStore;

beforeEach(() => {
  store = createMockStore();
});

describe('reportes', () => {
  it('sobreviven a que quien reporta borre su cuenta, con la instantánea', async () => {
    const repositories = createMockRepositories(store);
    await repositories.profiles.saveCurrent(buildProfileInput());
    await repositories.profiles.report({ profileId: NURIA, reason: 'acoso', details: 'x' });

    await repositories.session.deleteMyAccount();

    expect(store.state.userReports).toEqual([
      expect.objectContaining({
        reporterId: null,
        reportedId: NURIA,
        reporterRef: CURRENT_USER_ID,
        reportedRef: NURIA,
        reason: 'acoso',
      }),
    ]);
  });

  it('sobreviven a que la persona reportada se vaya', async () => {
    const repositories = createMockRepositories(store);
    await repositories.profiles.saveCurrent(buildProfileInput());
    await repositories.profiles.report({ profileId: NURIA, reason: 'spam' });

    store.deleteUser(NURIA);

    expect(store.state.userReports).toEqual([
      expect.objectContaining({
        reporterId: CURRENT_USER_ID,
        reportedId: null,
        reportedRef: NURIA,
      }),
    ]);
  });

  it('caducan a los 12 meses de su creación y no antes', async () => {
    const repositories = createMockRepositories(store);
    await repositories.profiles.saveCurrent(buildProfileInput());
    await repositories.profiles.report({ profileId: NURIA, reason: 'otro' });

    store.advanceClock(330 * DAY);
    expect(store.purgeOldReports()).toBe(0);
    expect(store.state.userReports).toHaveLength(1);

    store.advanceClock(70 * DAY);
    expect(store.purgeOldReports()).toBe(1);
    expect(store.state.userReports).toEqual([]);
  });
});

describe('bloquear y salas', () => {
  const inviteBoth = async () => {
    const repositories = createMockRepositories(store, { autoAcceptSessions: true });
    await repositories.profiles.saveCurrent(buildProfileInput());
    await repositories.discovery.recordDecision(NURIA, 'like');
    await repositories.discovery.recordDecision(ALBA, 'like');
    const view = await repositories.rooms.create({
      inviteeIds: [NURIA, ALBA],
      startsAt: new Date(store.nowMs() + 6 * MINUTE).toISOString(),
      blocks: 1,
    });
    return { repositories, roomId: view.room.id };
  };

  it('rechaza a la persona bloqueada en las salas que aún no han empezado', async () => {
    const { repositories, roomId } = await inviteBoth();

    await repositories.profiles.block(NURIA);

    const rows = store.state.roomMembers.filter((member) => member.roomId === roomId);
    expect(rows.find((member) => member.profileId === NURIA)).toMatchObject({
      status: 'rechazada',
      respondedAt: expect.any(String),
    });
    expect(rows.find((member) => member.profileId === ALBA)?.status).toBe('aceptada');
    const view = await repositories.rooms.getById(roomId);
    expect(view?.others.map(({ profile }) => profile.id)).toEqual([ALBA]);
  });

  it('no toca las filas de una sala ya empezada', async () => {
    const { repositories, roomId } = await inviteBoth();
    store.advanceClock(7 * MINUTE);

    await repositories.profiles.block(ALBA);

    const row = store.state.roomMembers.find(
      (member) => member.roomId === roomId && member.profileId === ALBA
    );
    expect(row?.status).toBe('aceptada');
  });

  it('avisa a quien sigue en la sala para que se relea', async () => {
    const { repositories } = await inviteBoth();
    const listener = jest.fn();
    const stop = store.subscribeTo(`rooms:${ALBA}`, listener);

    await repositories.profiles.block(NURIA);

    expect(listener).toHaveBeenCalled();
    stop();
  });
});
