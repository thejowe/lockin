/**
 * Mensajes sin leer en el backend mock. Espejo de
 * `supabase/unread-embedded.test.mjs`: mismas reglas sobre el store en memoria.
 */

import { createMockRepositories, createMockStore } from './index';

import type { MockStore } from './store';

const ANA = 'ana';
const BEA = 'bea';
const CAI = 'cai';
const MATCH = 'match-ab';
const GROUP = 'group-1';

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const HOUR = 3_600_000;

let store: MockStore;
const as = (actorId: string) => createMockRepositories(store, { actorId }).unread;

function message(senderId: string, sentAt = ago(HOUR)) {
  store.state.messages.push({
    id: store.createId('message'),
    matchId: MATCH,
    senderId,
    body: 'hola',
    sentAt,
  });
}

function groupMessage(senderId: string, sentAt = ago(HOUR)) {
  store.state.groupMessages.push({
    id: store.createId('group-message'),
    groupId: GROUP,
    senderId,
    body: 'hola',
    sentAt,
  });
}

beforeEach(() => {
  store = createMockStore();
  store.state.matches.push({
    id: MATCH,
    profileIds: [ANA, BEA],
    mode: 'par',
    createdAt: ago(10 * HOUR),
    lastMessageAt: null,
  });
});

it('cuenta lo que te escribe la otra persona, no lo tuyo', async () => {
  message(BEA);
  message(BEA);
  message(ANA);

  expect(await as(ANA).counts()).toEqual({ total: 2, byMatch: { [MATCH]: 2 }, byGroup: {} });
  expect(await as(BEA).counts()).toEqual({ total: 1, byMatch: { [MATCH]: 1 }, byGroup: {} });
});

it('marcar como leído pone el chat a cero y avisa', async () => {
  message(BEA);
  const unread = as(ANA);
  const listener = jest.fn();
  unread.subscribe(listener);

  await unread.markMatchRead(MATCH);

  expect(listener).toHaveBeenCalled();
  expect(await unread.counts()).toEqual({ total: 0, byMatch: {}, byGroup: {} });

  message(BEA, new Date(Date.now() + 1_000).toISOString());
  expect((await unread.counts()).byMatch[MATCH]).toBe(1);
});

it('con un bloqueo de por medio el chat no cuenta', async () => {
  message(BEA);
  store.state.userBlocks.set(ANA, new Set([BEA]));

  expect((await as(ANA).counts()).total).toBe(0);
});

it('no puedes marcar un chat ajeno', async () => {
  await expect(as(CAI).markMatchRead(MATCH)).rejects.toMatchObject({ code: '42501' });
  await expect(as(CAI).markGroupRead(GROUP)).rejects.toMatchObject({ code: '42501' });
});

it('grupo: cuenta desde que entraste y sin bloqueados', async () => {
  store.state.groupMembers.push(
    { groupId: GROUP, userId: ANA, roleId: null, joinedAt: ago(72 * HOUR) },
    { groupId: GROUP, userId: BEA, roleId: null, joinedAt: ago(72 * HOUR) },
    { groupId: GROUP, userId: CAI, roleId: null, joinedAt: ago(24 * HOUR) }
  );
  groupMessage(BEA, ago(48 * HOUR));
  groupMessage(BEA);
  groupMessage(ANA);

  expect((await as(CAI).counts()).byGroup).toEqual({ [GROUP]: 2 });
  expect((await as(ANA).counts()).byGroup).toEqual({ [GROUP]: 2 });

  store.state.userBlocks.set(CAI, new Set([BEA]));
  expect((await as(CAI).counts()).byGroup).toEqual({ [GROUP]: 1 });

  await as(CAI).markGroupRead(GROUP);
  expect(await as(CAI).counts()).toEqual({ total: 0, byMatch: {}, byGroup: {} });
});

it('borrar la cuenta borra sus marcas de lectura', async () => {
  message(BEA);
  await as(ANA).markMatchRead(MATCH);
  store.deleteUser(ANA);

  expect([...store.state.chatReads.keys()].some((key) => key.startsWith(`${ANA}:`))).toBe(false);
});
