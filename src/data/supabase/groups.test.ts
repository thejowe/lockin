/**
 * Repositorio de grupos contra un cliente de Supabase falso: qué RPC llama con
 * qué argumentos, cómo traduce filas y errores, y cuándo avisa. Las reglas de
 * verdad viven en SQL (`supabase/groups-embedded.test.mjs`).
 */

import { GroupError } from '../groups';
import { PremiumRequiredError } from '../premium-errors';
import {
  createSupabaseGroupRepository,
  toGroup,
  toGroupError,
  toGroupMember,
  toGroupMessage,
  toGroupRole,
} from './groups';

import type { LockInSupabaseClient } from './client';
import type {
  GroupMemberRow,
  GroupMessageRow,
  GroupRoleRow,
  GroupRow,
  ProfileRow,
} from './database.types';

type Result = { data: unknown; error: { code?: string; message: string } | null };
const ok = (data: unknown): Result => ({ data, error: null });
const fail = (code: string): Result => ({ data: null, error: { code, message: code } });
const timestamp = '2026-11-09T12:00:00+00:00';

const group: GroupRow = {
  id: 'g1',
  name: 'Equipo',
  description: 'Un proyecto',
  admin_id: 'me',
  max_members: 6,
  created_at: timestamp,
  updated_at: timestamp,
};
const roles: GroupRoleRow[] = [
  { id: 'r-dev', group_id: 'g1', specialty: 'dev', slots: 2, filled: 1 },
  { id: 'r-design', group_id: 'g1', specialty: 'diseno', slots: 1, filled: 0 },
];
const members: GroupMemberRow[] = [
  { group_id: 'g1', user_id: 'other', role_id: 'r-dev', joined_at: '2026-11-09T13:00:00+00:00' },
  { group_id: 'g1', user_id: 'me', role_id: null, joined_at: timestamp },
];
const message: GroupMessageRow = {
  id: 'm1',
  group_id: 'g1',
  sender_id: 'me',
  body: 'hola',
  sent_at: timestamp,
};
const profile = (id: string): ProfileRow => ({
  id,
  name: id,
  age: 30,
  location: 'Barcelona',
  timezone: 'Europe/Madrid',
  avatar_initials: 'AB',
  avatar_accent: 'brass',
  avatar_url: null,
  specialties: ['dev'],
  seeking_specialties: [],
  other_specialty: null,
  languages: [],
  seeking_languages: [],
  looking_for: 'par',
  starting_point: 'solo-ganas',
  availability_hours_per_week: 10,
  availability_bands: ['tarde'],
  ambition: 'lifestyle',
  link_github: null,
  github_handle: null,
  github_verified_at: null,
  link_portfolio: null,
  link_linkedin: null,
  link_instagram: null,
  link_tiktok: null,
  linkedin_name: null,
  linkedin_verified_at: null,
  prompts: [],
  created_at: timestamp,
  updated_at: timestamp,
});

interface FakeChannel {
  name: string;
  handlers: ((payload: { new: unknown }) => void)[];
  on: jest.Mock;
  subscribe: jest.Mock;
}

function fakeClient(overrides: Record<string, Result> = {}) {
  const results: Record<string, Result> = {
    'group_members:membership': ok([{ group_id: 'g1', joined_at: timestamp }]),
    groups: ok([group]),
    group_roles: ok(roles),
    group_members: ok(members),
    group_messages: ok([message]),
    'group_messages:insert': ok(message),
    profiles: ok([profile('me'), profile('other')]),
    ...overrides,
  };
  const rpcCalls: [string, unknown][] = [];
  const inserts: unknown[] = [];
  const channels: FakeChannel[] = [];
  const removeChannel = jest.fn();

  function from(table: string) {
    let key = table;
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'order']) {
      builder[method] = (...args: unknown[]) => {
        if (
          table === 'group_members' &&
          method === 'select' &&
          String(args[0]).startsWith('group_id')
        ) {
          key = 'group_members:membership';
        }
        return builder;
      };
    }
    builder.insert = (row: unknown) => {
      inserts.push(row);
      key = `${table}:insert`;
      return builder;
    };
    const settle = () => Promise.resolve(results[key] ?? ok(null));
    builder.maybeSingle = settle;
    builder.single = settle;
    builder.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
      settle().then(resolve, reject);
    return builder;
  }

  const client = {
    from,
    rpc: (name: string, args?: unknown) => {
      rpcCalls.push([name, args]);
      return Promise.resolve(results[name] ?? ok(null));
    },
    channel: (name: string) => {
      const channel: FakeChannel = {
        name,
        handlers: [],
        on: jest.fn(
          (_event: string, _filter: unknown, handler: (payload: { new: unknown }) => void) => {
            channel.handlers.push(handler);
            return channel;
          }
        ),
        subscribe: jest.fn(() => channel),
      };
      channels.push(channel);
      return channel;
    },
    removeChannel,
  };

  return {
    client: client as unknown as LockInSupabaseClient,
    rpcCalls,
    inserts,
    channels,
    removeChannel,
  };
}

function setup(overrides: Record<string, Result> = {}, userId = 'me') {
  const fake = fakeClient(overrides);
  const onBlocked = jest.fn();
  const signProfiles = jest.fn(async (list) => list);
  const repository = createSupabaseGroupRepository({
    getClient: () => fake.client,
    getUserId: async () => userId,
    signProfiles,
    onBlocked,
  });
  return { ...fake, repository, onBlocked, signProfiles };
}

describe('mapeadores', () => {
  it('traducen filas a dominio', () => {
    expect(toGroup(group)).toEqual({
      id: 'g1',
      name: 'Equipo',
      description: 'Un proyecto',
      adminId: 'me',
      maxMembers: 6,
      createdAt: '2026-11-09T12:00:00.000Z',
    });
    expect(toGroupRole(roles[0])).toEqual({
      id: 'r-dev',
      groupId: 'g1',
      specialty: 'dev',
      slots: 2,
      filled: 1,
    });
    expect(toGroupMember(members[1])).toEqual({
      groupId: 'g1',
      userId: 'me',
      roleId: null,
      joinedAt: '2026-11-09T12:00:00.000Z',
    });
    expect(toGroupMessage(message)).toEqual({
      id: 'm1',
      groupId: 'g1',
      senderId: 'me',
      body: 'hola',
      sentAt: timestamp,
    });
  });

  it('traducen los códigos del servidor', () => {
    const error = toGroupError({ code: 'LG002', message: 'ya' });
    expect(error).toBeInstanceOf(GroupError);
    expect((error as GroupError).reason).toBe('group-limit');
    expect(toGroupError({ code: 'LG006', message: 'admin' })).toMatchObject({
      reason: 'already-admin',
    });
    expect(toGroupError({ code: 'LQ005', message: 'premium' })).toBeInstanceOf(
      PremiumRequiredError
    );
    expect(toGroupError({ code: 'LI009', message: 'x' })).toMatchObject({ code: 'LI009' });
    expect(toGroupError({ message: 'sin código' })).toMatchObject({ code: '' });
  });
});

describe('listMine', () => {
  it('compone grupo, puestos y miembros por antigüedad, con sus perfiles firmados', async () => {
    const { repository, signProfiles } = setup();

    const [view] = await repository.listMine();
    expect(view.isAdmin).toBe(true);
    expect(view.roles.map((role) => role.id)).toEqual(['r-dev', 'r-design']);
    expect(
      view.members.map((entry) => [entry.member.userId, entry.specialty, entry.isAdmin])
    ).toEqual([
      ['me', null, true],
      ['other', 'dev', false],
    ]);
    expect(view.members[1].profile?.name).toBe('other');
    expect(signProfiles).toHaveBeenCalled();
  });

  it('sin pertenencias o sin grupo legible devuelve una lista vacía', async () => {
    expect(await setup({ 'group_members:membership': ok([]) }).repository.listMine()).toEqual([]);
    expect(await setup({ groups: ok([]) }).repository.listMine()).toEqual([]);
  });

  it('con varios grupos, el que administra va primero y cada uno lleva lo suyo', async () => {
    const other = { ...group, id: 'g0', name: 'Otro', admin_id: 'other' };
    const { repository } = setup({
      'group_members:membership': ok([
        { group_id: 'g0', joined_at: timestamp },
        { group_id: 'g1', joined_at: timestamp },
      ]),
      groups: ok([group, other]),
      group_roles: ok([...roles, { ...roles[0], id: 'r-other', group_id: 'g0' }]),
      group_members: ok([
        ...members,
        { ...members[0], group_id: 'g0', user_id: 'other', role_id: null },
        { ...members[1], group_id: 'g0', user_id: 'me', role_id: 'r-other' },
      ]),
    });

    const views = await repository.listMine();
    expect(views.map((view) => [view.group.id, view.isAdmin])).toEqual([
      ['g1', true],
      ['g0', false],
    ]);
    expect(views[1].roles.map((role) => role.id)).toEqual(['r-other']);
    expect(views[1].members.map((entry) => entry.member.userId).sort()).toEqual(['me', 'other']);
  });

  it('un miembro cuyo perfil no se puede leer queda sin perfil', async () => {
    const [view] = await setup({ profiles: ok([profile('me')]) }, 'other').repository.listMine();
    expect(view.isAdmin).toBe(false);
    expect(view.members[1].profile).toBeNull();
  });

  it.each(['group_members:membership', 'groups', 'group_roles', 'group_members', 'profiles'])(
    'propaga el fallo de %s',
    async (source) => {
      await expect(setup({ [source]: fail('500') }).repository.listMine()).rejects.toMatchObject({
        code: '500',
      });
    }
  );
});

describe('escrituras', () => {
  it('create llama al RPC, avisa y devuelve el grupo', async () => {
    const { repository, rpcCalls } = setup();
    const listener = jest.fn();
    repository.subscribe(listener);

    const view = await repository.create({
      name: 'Equipo',
      description: 'Un proyecto',
      roles: [{ specialty: 'dev', slots: 2 }],
    });

    expect(rpcCalls[0]).toEqual([
      'create_group',
      {
        p_name: 'Equipo',
        p_description: 'Un proyecto',
        p_roles: [{ specialty: 'dev', slots: 2 }],
        p_max_members: 6,
      },
    ]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(view.group.id).toBe('g1');
  });

  it('update llama al RPC con el conjunto de perfiles, avisa y relee el grupo', async () => {
    const { repository, rpcCalls } = setup();
    const listener = jest.fn();
    repository.subscribe(listener);

    const view = await repository.update({
      name: 'Equipo',
      description: 'Un proyecto',
      roles: [{ specialty: 'legal', slots: 1 }],
    });

    expect(rpcCalls[0]).toEqual([
      'update_group',
      {
        p_name: 'Equipo',
        p_description: 'Un proyecto',
        p_roles: [{ specialty: 'legal', slots: 1 }],
      },
    ]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(view.group.id).toBe('g1');

    const input = { name: 'x', description: 'y', roles: [] };
    await expect(
      setup({ update_group: fail('LG004') }).repository.update(input)
    ).rejects.toMatchObject({ reason: 'admin-only' });
    await expect(
      setup({ 'group_members:membership': ok([]) }).repository.update(input)
    ).rejects.toMatchObject({ reason: 'unavailable' });
  });

  it('create traduce el rechazo y falla si el grupo no se puede leer después', async () => {
    await expect(
      setup({ create_group: fail('LG002') }).repository.create({
        name: 'x',
        description: 'y',
        roles: [],
      })
    ).rejects.toMatchObject({ reason: 'group-limit' });
    await expect(
      setup({ 'group_members:membership': ok([]) }).repository.create({
        name: 'x',
        description: 'y',
        roles: [],
        maxMembers: 4,
      })
    ).rejects.toMatchObject({ reason: 'unavailable' });
  });

  it('los swipes devuelven si hubo unión y solo entonces avisan', async () => {
    const joined = setup({ swipe_group: ok(true), swipe_group_candidate: ok(true) });
    const listener = jest.fn();
    joined.repository.subscribe(listener);
    expect(await joined.repository.swipeGroup('g1', 'like')).toEqual({
      decision: 'like',
      joined: true,
    });
    expect(await joined.repository.swipeCandidate('u1', 'r-dev', 'like')).toEqual({
      decision: 'like',
      joined: true,
    });
    expect(joined.rpcCalls).toEqual([
      ['swipe_group', { p_group_id: 'g1', p_decision: 'like' }],
      ['swipe_group_candidate', { p_user_id: 'u1', p_role_id: 'r-dev', p_decision: 'like' }],
    ]);
    expect(listener).toHaveBeenCalledTimes(2);

    const pending = setup({ swipe_group: ok(false), swipe_group_candidate: ok(false) });
    const quiet = jest.fn();
    pending.repository.subscribe(quiet);
    expect((await pending.repository.swipeGroup('g1', 'pass')).joined).toBe(false);
    expect((await pending.repository.swipeCandidate('u1', 'r-dev', 'pass')).joined).toBe(false);
    expect(quiet).not.toHaveBeenCalled();

    await expect(
      setup({ swipe_group: fail('LG003') }).repository.swipeGroup('g1', 'like')
    ).rejects.toMatchObject({
      reason: 'unavailable',
    });
    await expect(
      setup({ swipe_group_candidate: fail('LG005') }).repository.swipeCandidate('u', 'r', 'like')
    ).rejects.toMatchObject({ reason: 'candidate-unavailable' });
  });

  it('salir, expulsar, reportar y bloquear llaman a su RPC', async () => {
    const { repository, rpcCalls, onBlocked } = setup();
    await repository.leave('g1');
    await repository.kick('u1');
    await repository.report({ groupId: 'g1', reason: 'spam' });
    await repository.report({ groupId: 'g1', reason: 'spam', details: 'x' });
    await repository.reportMessage({ messageId: 'm1', reason: 'acoso' });
    await repository.block('g1');

    expect(rpcCalls).toEqual([
      ['leave_group', { p_group_id: 'g1' }],
      ['kick_group_member', { p_user_id: 'u1' }],
      ['report_group', { p_group_id: 'g1', p_reason: 'spam', p_details: null }],
      ['report_group', { p_group_id: 'g1', p_reason: 'spam', p_details: 'x' }],
      ['report_group_message', { p_message_id: 'm1', p_reason: 'acoso', p_details: null }],
      ['block_group', { p_group_id: 'g1' }],
    ]);
    expect(onBlocked).toHaveBeenCalledTimes(1);
  });

  it.each<[string, (r: ReturnType<typeof setup>['repository']) => Promise<unknown>]>([
    ['leave_group', (r) => r.leave('g')],
    ['kick_group_member', (r) => r.kick('u')],
    ['report_group', (r) => r.report({ groupId: 'g', reason: 'spam' })],
    ['report_group_message', (r) => r.reportMessage({ messageId: 'm', reason: 'spam' })],
    ['block_group', (r) => r.block('g')],
  ])('%s traduce su error', async (rpc, run) => {
    await expect(run(setup({ [rpc]: fail('LG004') }).repository)).rejects.toMatchObject({
      reason: 'admin-only',
    });
  });

  it('sin `onBlocked` ni firmador también funciona', async () => {
    const fake = fakeClient();
    const repository = createSupabaseGroupRepository({
      getClient: () => fake.client,
      getUserId: async () => 'me',
    });
    await repository.block('g1');
    expect((await repository.listMine())[0]?.members).toHaveLength(2);
    expect(await repository.getRecruitDeck()).toEqual([]);
  });
});

describe('decks', () => {
  const deckRow = {
    ...group,
    my_role_id: 'r-design',
    roles,
    members,
  };

  it('getDeck traduce cada carta con tu puesto y los perfiles de dentro', async () => {
    const { repository } = setup({
      group_deck: ok([deckRow, { ...deckRow, id: 'g2', my_role_id: 'no' }]),
    });
    const deck = await repository.getDeck();
    expect(deck).toHaveLength(1);
    expect(deck[0].myRole.specialty).toBe('diseno');
    expect(deck[0].members.map((entry) => entry.profile?.id)).toEqual(['me', 'other']);
  });

  it('getDeck sin cartas no pide perfiles, y propaga el error', async () => {
    expect(await setup({ group_deck: ok(null) }).repository.getDeck()).toEqual([]);
    await expect(setup({ group_deck: fail('LG003') }).repository.getDeck()).rejects.toMatchObject({
      reason: 'unavailable',
    });
  });

  it('getRecruitDeck une cada persona con el puesto de tu grupo', async () => {
    const { repository } = setup({
      group_recruit_deck: ok([
        { role_id: 'r-dev', profile: profile('cand') },
        { role_id: 'desconocido', profile: profile('otro') },
      ]),
    });
    const deck = await repository.getRecruitDeck();
    expect(deck.map((card) => [card.profile.id, card.role.specialty])).toEqual([['cand', 'dev']]);

    await expect(
      setup({ group_recruit_deck: fail('LG004') }).repository.getRecruitDeck()
    ).rejects.toMatchObject({ reason: 'admin-only' });
    expect(await setup({ group_recruit_deck: ok(null) }).repository.getRecruitDeck()).toEqual([]);
  });
});

describe('chat', () => {
  it('lista y envía; el envío avisa al instante y su eco no repite', async () => {
    const { repository, inserts, channels } = setup();
    const listener = jest.fn();
    const stop = repository.subscribeMessages('g1', listener);
    const second = repository.subscribeMessages('g1', jest.fn());

    expect((await repository.listMessages('g1')).map((entry) => entry.body)).toEqual(['hola']);
    const sent = await repository.sendMessage('g1', 'hola');
    expect(inserts).toEqual([{ group_id: 'g1', sender_id: 'me', body: 'hola' }]);
    expect(sent.id).toBe('m1');
    expect(listener).toHaveBeenCalledTimes(1);

    expect(channels).toHaveLength(1);
    expect(channels[0].name).toBe('lockin:group-messages:g1');
    channels[0].handlers[0]({ new: { id: 'm1' } });
    expect(listener).toHaveBeenCalledTimes(1);
    channels[0].handlers[0]({ new: { id: 'm2' } });
    channels[0].handlers[0]({ new: undefined });
    expect(listener).toHaveBeenCalledTimes(3);

    stop();
    stop();
    expect(fakeRemoved(channels)).toBe(0);
    second();
  });

  it('propaga los fallos de lectura y de envío', async () => {
    await expect(
      setup({ group_messages: fail('500') }).repository.listMessages('g1')
    ).rejects.toMatchObject({
      code: '500',
    });
    await expect(
      setup({ 'group_messages:insert': fail('42501') }).repository.sendMessage('g1', 'x')
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('el canal de mensajes se cierra con el último suscriptor', () => {
    const { repository, removeChannel } = setup();
    const a = repository.subscribeMessages('g1', jest.fn());
    const b = repository.subscribeMessages('g1', jest.fn());
    a();
    expect(removeChannel).not.toHaveBeenCalled();
    b();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });
});

/** Canales retirados entre los abiertos: aquí solo importa que no se cierre antes de tiempo. */
function fakeRemoved(channels: FakeChannel[]): number {
  return channels.filter((channel) => channel.subscribe.mock.calls.length === 0).length;
}

describe('suscripción al grupo', () => {
  it('abre un solo canal privado, avisa con cada UPDATE y lo cierra al final', () => {
    const { repository, channels, removeChannel } = setup();
    const first = jest.fn();
    const second = jest.fn();
    const stopFirst = repository.subscribe(first);
    const stopSecond = repository.subscribe(second);

    expect(channels).toHaveLength(1);
    expect(channels[0].name).toBe('lockin:groups');
    expect(channels[0].on.mock.calls[0][1]).toEqual({
      event: 'UPDATE',
      schema: 'public',
      table: 'groups',
    });
    // Un grupo disuelto con gente dentro también avisa.
    expect(channels[0].on.mock.calls[1][1]).toEqual({
      event: 'DELETE',
      schema: 'public',
      table: 'groups',
    });
    channels[0].handlers[0]({ new: {} });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    channels[0].handlers[1]({ new: {} });
    expect(first).toHaveBeenCalledTimes(2);

    stopFirst();
    stopFirst();
    expect(removeChannel).not.toHaveBeenCalled();
    stopSecond();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });
});
