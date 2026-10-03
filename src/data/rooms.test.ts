import {
  canCancelRoom,
  canRespondToRoom,
  isInRoomJoinWindow,
  isRoomLive,
  RoomInviteError,
  roomEndsAtMs,
  validateRoomInvitees,
} from './rooms';

import type { LockInRoom, RoomMember, RoomMemberStatus } from './types';

const MINUTE = 60_000;
const START = Date.parse('2026-10-05T10:00:00.000Z');
const ENDS_AT = START + 60 * MINUTE;
const JOIN_AT = START - 5 * MINUTE;

const room = (overrides: Partial<LockInRoom> = {}): LockInRoom => ({
  id: 'room-1',
  hostId: 'host',
  startsAt: '2026-10-05T10:00:00.000Z',
  blocks: 2,
  cancelledAt: null,
  createdAt: '2026-10-04T10:00:00.000Z',
  ...overrides,
});

const member = (status: RoomMemberStatus): RoomMember => ({
  roomId: 'room-1',
  profileId: 'p1',
  status,
  respondedAt: status === 'invitada' ? null : '2026-10-04T11:00:00.000Z',
  joinedAt: null,
  leftAt: null,
});

describe('roomEndsAtMs', () => {
  it('dos bloques terminan 60 minutos después del inicio', () => {
    expect(roomEndsAtMs(room())).toBe(ENDS_AT);
  });
});

describe('isRoomLive', () => {
  it('vive hasta el final, exclusivo', () => {
    expect(isRoomLive(room(), ENDS_AT - 1)).toBe(true);
    expect(isRoomLive(room(), ENDS_AT)).toBe(false);
  });

  it('cancelada no está viva aunque falte una hora', () => {
    expect(isRoomLive(room({ cancelledAt: room().createdAt }), START - 60 * MINUTE)).toBe(false);
  });
});

describe('isInRoomJoinWindow', () => {
  it('abre cinco minutos antes, incluidos, y cierra al final para una aceptada', () => {
    expect(isInRoomJoinWindow(room(), member('aceptada'), JOIN_AT - 1)).toBe(false);
    expect(isInRoomJoinWindow(room(), member('aceptada'), JOIN_AT)).toBe(true);
    expect(isInRoomJoinWindow(room(), member('aceptada'), ENDS_AT - 1)).toBe(true);
    expect(isInRoomJoinWindow(room(), member('aceptada'), ENDS_AT)).toBe(false);
  });

  it.each(['invitada', 'rechazada'] as const)('una %s no puede entrar', (status) => {
    expect(isInRoomJoinWindow(room(), member(status), START)).toBe(false);
  });

  it('no permite entrar a una sala cancelada', () => {
    expect(
      isInRoomJoinWindow(room({ cancelledAt: room().createdAt }), member('aceptada'), START)
    ).toBe(false);
  });
});

describe('canRespondToRoom', () => {
  it.each(['invitada', 'aceptada'] as const)(
    'una %s puede responder solo antes de abrirse la ventana',
    (status) => {
      expect(canRespondToRoom(room(), member(status), JOIN_AT - 1)).toBe(true);
      expect(canRespondToRoom(room(), member(status), JOIN_AT)).toBe(false);
    }
  );

  it('quien convoca no puede responder', () => {
    const me = { ...member('aceptada'), profileId: 'host' };
    expect(canRespondToRoom(room(), me, JOIN_AT - 1)).toBe(false);
  });

  it('una rechazada no puede responder', () => {
    expect(canRespondToRoom(room(), member('rechazada'), JOIN_AT - 1)).toBe(false);
  });

  it('no permite responder a una sala cancelada', () => {
    expect(
      canRespondToRoom(room({ cancelledAt: room().createdAt }), member('invitada'), JOIN_AT - 1)
    ).toBe(false);
  });
});

describe('canCancelRoom', () => {
  it('quien convoca puede cancelar hasta el inicio, exclusivo', () => {
    expect(canCancelRoom(room(), 'host', START - 1)).toBe(true);
    expect(canCancelRoom(room(), 'host', START)).toBe(false);
  });

  it('otra persona no puede cancelar', () => {
    expect(canCancelRoom(room(), 'p1', START - 1)).toBe(false);
  });

  it('una sala ya cancelada no se puede cancelar', () => {
    expect(canCancelRoom(room({ cancelledAt: room().createdAt }), 'host', START - 1)).toBe(false);
  });
});

describe('validateRoomInvitees', () => {
  const matchIds = new Set(['p1', 'p2', 'p3', 'p4', 'p5', 'host']);

  it.each([{ inviteeIds: ['p1', 'p2'] }, { inviteeIds: ['p1', 'p2', 'p3', 'p4'] }])(
    'acepta los matches $inviteeIds',
    ({ inviteeIds }) => {
      expect(validateRoomInvitees(inviteeIds, 'host', matchIds)).toBeNull();
    }
  );

  it.each([
    ['un solo invitado', ['p1']],
    ['cinco invitados', ['p1', 'p2', 'p3', 'p4', 'p5']],
    ['un repetido', ['p1', 'p1']],
    ['el propio id', ['host', 'p1']],
    ['alguien que no es match', ['p1', 'stranger']],
  ])('rechaza %s con RoomInviteError', (_case, inviteeIds) => {
    expect(validateRoomInvitees(inviteeIds, 'host', matchIds)).toBeInstanceOf(RoomInviteError);
  });
});

describe('RoomInviteError', () => {
  it('se distingue con instanceof y conserva el nombre y el mensaje', () => {
    const error = new RoomInviteError('detalle');
    expect(error).toBeInstanceOf(RoomInviteError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('RoomInviteError');
    expect(error.message).toBe('detalle');
  });
});
