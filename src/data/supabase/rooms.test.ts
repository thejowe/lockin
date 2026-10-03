import { RoomInviteError } from '../rooms';
import {
  SessionConflictError,
  SessionExpiredError,
  SessionForbiddenError,
  SessionWindowError,
} from '../session-errors';
import { toProfile } from './mappers';
import { createSupabaseRoomRepository, toLockInRoom, toRoomMember, toRoomError } from './rooms';

import type { LockInSupabaseClient } from './client';
import type { ProfileRow, RoomRow, RoomMemberRow } from './database.types';
import type { RoomRepository } from '../repositories';

type Result = { data: unknown; error: { code?: string; message: string } | null };
interface FakeChannel {
  on: jest.Mock<FakeChannel, [string, unknown, () => void]>;
  subscribe: jest.Mock<FakeChannel, [(value: string) => void]>;
}
const ok = (data: unknown): Result => ({ data, error: null });
const timestamp = '2026-10-03T12:00:00+00:00';
const room: RoomRow = {
  id: 'room',
  host_id: 'host',
  starts_at: timestamp,
  blocks: 2,
  cancelled_at: null,
  created_at: timestamp,
  updated_at: timestamp,
};
const member: RoomMemberRow = {
  room_id: 'room',
  profile_id: 'me',
  status: 'invitada',
  responded_at: null,
  joined_at: null,
  left_at: null,
};
const profile = (id: string): ProfileRow => ({
  id,
  name: id,
  age: 30,
  location: 'Barcelona',
  timezone: 'Europe/Madrid',
  avatar_initials: 'AB',
  avatar_accent: 'brass',
  specialties: ['dev'],
  seeking_specialties: [],
  looking_for: 'ambos',
  starting_point: 'solo-ganas',
  availability_hours_per_week: 10,
  availability_bands: ['tarde'],
  ambition: 'lifestyle',
  link_github: null,
  github_handle: null,
  github_verified_at: null,
  link_portfolio: null,
  link_linkedin: null,
  prompts: [],
  created_at: timestamp,
  updated_at: timestamp,
});

/** Cliente encadenable y paginado; cada consulta registra filtros y rangos. */
function fakeClient(overrides: Record<string, Result> = {}) {
  const results: Record<string, Result> = {
    lockin_rooms: ok(room),
    room_members: ok([member, { ...member, profile_id: 'host', status: 'aceptada' }]),
    profiles: ok([profile('host')]),
    live_rooms: ok([room]),
    ...overrides,
  };
  const queries: { source: string; calls: [string, unknown[]][] }[] = [];
  function query(source: string) {
    const record = { source, calls: [] as [string, unknown[]][] };
    queries.push(record);
    let range: [number, number] | undefined;
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'order', 'range']) {
      builder[method] = (...args: unknown[]) => {
        record.calls.push([method, args]);
        if (method === 'range') range = args as [number, number];
        return builder;
      };
    }
    const result = () => {
      const value = results[source] ?? ok(null);
      return range && Array.isArray(value.data)
        ? { ...value, data: value.data.slice(range[0], range[1] + 1) }
        : value;
    };
    builder.maybeSingle = () => Promise.resolve(result());
    builder.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result()).then(resolve, reject);
    return builder;
  }
  let change = () => {};
  let status: (value: string) => void = () => {};
  const channel: FakeChannel = {
    on: jest.fn((_event: string, _filter: unknown, callback: () => void) => {
      change = callback;
      return channel;
    }),
    subscribe: jest.fn((callback: (value: string) => void) => {
      status = callback;
      return channel;
    }),
  };
  const client = {
    from: jest.fn(query),
    rpc: jest.fn((name: string, _args?: unknown) => query(name)),
    channel: jest.fn(() => channel),
    removeChannel: jest.fn(async () => 'ok'),
  };
  const getUserId = jest.fn(async () => 'me');
  const repo = createSupabaseRoomRepository({
    getClient: () => client as unknown as LockInSupabaseClient,
    getUserId,
  });
  return {
    repo,
    client,
    channel,
    queries,
    results,
    getUserId,
    change: () => change(),
    status: (value: string) => status(value),
  };
}

describe('salas Supabase', () => {
  it('mapea la sala y normaliza las fechas sin exponer updated_at', () => {
    expect(toLockInRoom(room)).toEqual({
      id: 'room',
      hostId: 'host',
      startsAt: '2026-10-03T12:00:00.000Z',
      blocks: 2,
      cancelledAt: null,
      createdAt: '2026-10-03T12:00:00.000Z',
    });
    expect(toLockInRoom({ ...room, cancelled_at: timestamp }).cancelledAt).toBe(
      '2026-10-03T12:00:00.000Z'
    );
  });
  it('mapea miembros con fechas nulas y con asistencia', () => {
    expect(toRoomMember(member)).toEqual({
      roomId: 'room',
      profileId: 'me',
      status: 'invitada',
      respondedAt: null,
      joinedAt: null,
      leftAt: null,
    });
    expect(
      toRoomMember({ ...member, responded_at: timestamp, joined_at: timestamp, left_at: timestamp })
    ).toMatchObject({
      respondedAt: '2026-10-03T12:00:00.000Z',
      joinedAt: '2026-10-03T12:00:00.000Z',
      leftAt: '2026-10-03T12:00:00.000Z',
    });
  });
  it.each([
    ['LI001', SessionConflictError],
    ['LI002', SessionExpiredError],
    ['LI003', SessionWindowError],
    ['LI004', SessionForbiddenError],
    ['LI006', RoomInviteError],
  ] as const)('traduce %s', (code, ErrorClass) => {
    const error = toRoomError({ code, message: 'motivo' });
    expect(error).toBeInstanceOf(ErrorClass);
    expect(error).toHaveProperty('message', 'motivo');
  });
  it.each([undefined, '42501'])('conserva el error desconocido %s', (code) => {
    const error = { code, message: 'red' };
    expect(toRoomError(error)).toBe(error);
  });
  it('getById arma me y others con perfiles, ordenados, sin filtrar estados del servidor', async () => {
    const f = fakeClient({
      room_members: ok([
        member,
        { ...member, profile_id: 'z', status: 'rechazada' },
        { ...member, profile_id: 'a', status: 'aceptada' },
        { ...member, profile_id: 'missing' },
      ]),
      profiles: ok([profile('z'), profile('a')]),
    });
    expect(await f.repo.getById('room')).toEqual({
      room: toLockInRoom(room),
      me: toRoomMember(member),
      others: [
        {
          member: toRoomMember({ ...member, profile_id: 'a', status: 'aceptada' }),
          profile: toProfile(profile('a')),
        },
        {
          member: toRoomMember({ ...member, profile_id: 'z', status: 'rechazada' }),
          profile: toProfile(profile('z')),
        },
      ],
    });
    expect(f.queries[0]).toEqual({
      source: 'lockin_rooms',
      calls: [
        ['select', ['*']],
        ['eq', ['id', 'room']],
      ],
    });
    expect(f.getUserId).toHaveBeenCalled();
  });
  it('devuelve null sin sala y no lee miembros', async () => {
    const f = fakeClient({ lockin_rooms: ok(null) });
    expect(await f.repo.getById('missing')).toBeNull();
    expect(f.client.from).toHaveBeenCalledTimes(1);
  });
  it('devuelve null sin fila propia', async () => {
    const f = fakeClient({ room_members: ok([]) });
    expect(await f.repo.getById('room')).toBeNull();
  });
  it('listLive lee miembros y perfiles en lote, deduplicando perfiles', async () => {
    const second = { ...room, id: 'second' };
    const members = [
      member,
      { ...member, profile_id: 'host' },
      { ...member, room_id: 'second' },
      { ...member, room_id: 'second', profile_id: 'host' },
    ];
    const f = fakeClient({ live_rooms: ok([room, second]), room_members: ok(members) });
    expect(await f.repo.listLive()).toHaveLength(2);
    expect(f.client.rpc).toHaveBeenCalledWith('live_rooms');
    expect(f.client.from.mock.calls).toEqual([['room_members'], ['profiles']]);
    expect(f.queries.find((q) => q.source === 'room_members')?.calls).toContainEqual([
      'in',
      ['room_id', ['room', 'second']],
    ]);
    expect(f.queries.find((q) => q.source === 'profiles')?.calls).toContainEqual([
      'in',
      ['id', ['host']],
    ]);
  });
  it('lista vacía no consulta tablas', async () => {
    const f = fakeClient({ live_rooms: ok([]) });
    expect(await f.repo.listLive()).toEqual([]);
    expect(f.client.from).not.toHaveBeenCalled();
  });
  it('pagina salas, miembros y perfiles más allá de 500 filas', async () => {
    const rooms = Array.from({ length: 501 }, (_, i) => ({ ...room, id: `room-${i}` }));
    const members = rooms.flatMap((r) => [
      { ...member, room_id: r.id },
      { ...member, room_id: r.id, profile_id: r.id },
    ]);
    const f = fakeClient({
      live_rooms: ok(rooms),
      room_members: ok(members),
      profiles: ok(rooms.map((r) => profile(r.id))),
    });
    const views = await f.repo.listLive();
    expect(views).toHaveLength(501);
    expect(views[500].others[0].profile.id).toBe('room-500');
    for (const source of ['live_rooms', 'room_members', 'profiles'])
      expect(
        f.queries
          .filter((q) => q.source === source)
          .map((q) => q.calls.find(([method]) => method === 'range')?.[1])
      ).toEqual(
        source === 'room_members'
          ? [
              [0, 499],
              [500, 999],
              [1000, 1499],
            ]
          : [
              [0, 499],
              [500, 999],
            ]
      );
  });
  it.each(['lockin_rooms', 'room_members', 'profiles', 'live_rooms'])(
    'propaga errores de lectura de %s',
    async (source) => {
      const error = { message: 'lectura fallida' };
      const f = fakeClient({ [source]: { data: null, error } });
      await expect(
        source === 'live_rooms' ? f.repo.listLive() : f.repo.getById('room')
      ).rejects.toBe(error);
    }
  );
  const writes: [
    string,
    (repo: RoomRepository) => Promise<unknown>,
    Record<string, unknown>,
    RoomRow | RoomMemberRow,
  ][] = [
    [
      'create_room',
      (repo) => repo.create({ inviteeIds: ['a', 'b'], startsAt: timestamp, blocks: 2 }),
      { p_invitee_ids: ['a', 'b'], p_starts_at: timestamp, p_blocks: 2 },
      room,
    ],
    [
      'respond_room',
      (repo) => repo.respond('room', 'rechazada'),
      { p_room_id: 'room', p_answer: 'rechazada' },
      { ...member, status: 'rechazada' },
    ],
    [
      'cancel_room',
      (repo) => repo.cancel('room'),
      { p_room_id: 'room' },
      { ...room, cancelled_at: timestamp },
    ],
    [
      'join_room',
      (repo) => repo.join('room'),
      { p_room_id: 'room' },
      { ...member, joined_at: timestamp },
    ],
    [
      'leave_room',
      (repo) => repo.leave('room'),
      { p_room_id: 'room' },
      { ...member, left_at: timestamp },
    ],
  ];
  it.each(writes)('%s escribe por RPC y avisa inmediatamente', async (rpc, write, args, row) => {
    const f = fakeClient({ [rpc]: ok(row) });
    const listener = jest.fn();
    f.repo.subscribe(listener);
    const result = await write(f.repo);
    expect(f.client.rpc).toHaveBeenCalledWith(rpc, args);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(f.getUserId).toHaveBeenCalled();
    if (rpc === 'create_room')
      expect(result).toMatchObject({ room: toLockInRoom(room), me: toRoomMember(member) });
    else
      expect(result).toEqual(
        rpc === 'cancel_room' ? toLockInRoom(row as RoomRow) : toRoomMember(row as RoomMemberRow)
      );
  });
  it.each(writes)('%s traduce el error y no avisa al fallar', async (rpc, write) => {
    const f = fakeClient({ [rpc]: { data: null, error: { code: 'LI004', message: 'prohibido' } } });
    const listener = jest.fn();
    f.repo.subscribe(listener);
    await expect(write(f.repo)).rejects.toBeInstanceOf(SessionForbiddenError);
    expect(listener).not.toHaveBeenCalled();
  });
  it('create avisa aunque la relectura ya no vea la sala', async () => {
    const f = fakeClient({ create_room: ok(room), lockin_rooms: ok(null) });
    const listener = jest.fn();
    f.repo.subscribe(listener);
    await expect(
      f.repo.create({ inviteeIds: ['a', 'b'], startsAt: timestamp, blocks: 2 })
    ).rejects.toBeInstanceOf(SessionForbiddenError);
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it('comparte un canal solo de salas, resincroniza y cierra con el último listener', () => {
    const f = fakeClient();
    const a = jest.fn();
    const b = jest.fn();
    const stopA = f.repo.subscribe(a);
    const stopB = f.repo.subscribe(b);
    expect(f.client.channel.mock.calls).toEqual([['lockin:rooms']]);
    expect(f.channel.on.mock.calls).toEqual([
      [
        'postgres_changes',
        // Solo UPDATE: los DELETE llegan sin RLS a cualquier suscriptor.
        { event: 'UPDATE', schema: 'public', table: 'lockin_rooms' },
        expect.any(Function),
      ],
    ]);
    f.status('SUBSCRIBED');
    expect(a).not.toHaveBeenCalled();
    f.change();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    f.status('CHANNEL_ERROR');
    f.status('SUBSCRIBED');
    expect(a).toHaveBeenCalledTimes(2);
    stopA();
    f.change();
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(3);
    expect(f.client.removeChannel).not.toHaveBeenCalled();
    stopB();
    expect(f.client.removeChannel).toHaveBeenCalledWith(f.channel);
    f.repo.subscribe(a);
    expect(f.client.channel).toHaveBeenCalledTimes(2);
  });
});
