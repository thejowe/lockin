/**
 * Salas Lock-In grupales del backend mock.
 *
 * Como las sesiones (`./sessions.ts`), se construye para un actor: la suite de
 * contrato necesita a las invitadas aceptando y rechazando, y en memoria no hay
 * sesiones de verdad que abrir. La app usa siempre `CURRENT_USER_ID`; los tests
 * crean también los repositorios de las demás personas sobre el mismo store.
 *
 * **El ciego de invitados vive aquí igual que en la política de RLS de
 * `room_members`** (`supabase/migrations/20261002000100_lockin_rooms.sql`): una
 * invitada ve a quien convoca y a quien ya aceptó; quien convoca ve a todo el
 * mundo. Los avisos siguen la misma regla que el `UPDATE` de `lockin_rooms`
 * filtrado por RLS: solo los recibe quien participa en la sala.
 *
 * `autoAcceptFrom` hace de las invitadas un bot, como en las sesiones: las de
 * esa lista aceptan en el acto, para poder convocar con dos matches semilla y
 * entrar a la sala sin nadie al otro lado. Por defecto está vacía.
 */

import { canRespondToRoom, isInRoomJoinWindow, isRoomLive, validateRoomInvitees } from '../rooms';
import {
  SessionConflictError,
  SessionExpiredError,
  SessionForbiddenError,
  SessionWindowError,
} from '../session-errors';
import { isSessionBlocks, isValidStartsAt } from '../sessions';
import { defaultMockStore } from './store';

import type { MockStore } from './store';
import type { RoomRepository } from '../repositories';
import type { LockInRoom, Profile, RoomMember, RoomView } from '../types';

/** Tópico de avisos de las salas de una persona. */
export const roomsTopic = (profileId: string) => `rooms:${profileId}`;

export interface MockRoomOptions {
  /** Perfiles que aceptan al instante la invitación del actor. */
  autoAcceptFrom?: Iterable<string>;
}

const iso = (ms: number) => new Date(ms).toISOString();

export function createMockRoomRepository(
  actorId: string,
  store: MockStore = defaultMockStore,
  options: MockRoomOptions = {}
): RoomRepository {
  const autoAcceptFrom = new Set(options.autoAcceptFrom ?? []);
  const getState = () => store.state;
  const mockNowMs = () => store.nowMs();

  const membersOf = (roomId: string): RoomMember[] =>
    getState().roomMembers.filter((member) => member.roomId === roomId);

  const rowOf = (roomId: string, profileId: string): RoomMember | undefined =>
    getState().roomMembers.find(
      (member) => member.roomId === roomId && member.profileId === profileId
    );

  /** La fila del actor si la sala le es visible: existe y no la rechazó. */
  const myRow = (roomId: string): RoomMember | null => {
    const row = rowOf(roomId, actorId);
    return row && row.status !== 'rechazada' ? row : null;
  };

  const matchIdsOfActor = (): Set<string> =>
    new Set(
      getState()
        .matches.filter((match) => match.profileIds.includes(actorId))
        .flatMap((match) => match.profileIds.filter((id) => id !== actorId))
    );

  /**
   * Espejo de `lock_room_for_member`: la sala existe y el actor tiene fila no
   * rechazada. Si no, `SessionForbiddenError`, sin distinguir los dos casos.
   */
  const mustSee = (roomId: string): { room: LockInRoom; me: RoomMember } => {
    const room = getState().rooms.find((candidate) => candidate.id === roomId);
    const me = room ? myRow(roomId) : null;
    if (!room || !me) throw new SessionForbiddenError('La sala no existe o no estás en ella');
    return { room, me };
  };

  /** El ciego de invitados: la misma regla que la política de `room_members`. */
  const toView = (room: LockInRoom, me: RoomMember): RoomView => {
    const profiles = getState().profiles;
    const isHost = room.hostId === actorId;
    const others = membersOf(room.id)
      .filter((member) => member.profileId !== actorId)
      .filter((member) => isHost || member.status === 'aceptada')
      .sort((a, b) => (a.profileId < b.profileId ? -1 : a.profileId > b.profileId ? 1 : 0))
      .flatMap((member) => {
        const profile: Profile | undefined = profiles.get(member.profileId);
        return profile ? [{ member: { ...member }, profile }] : [];
      });
    return { room: { ...room }, me: { ...me }, others };
  };

  /**
   * Avisa a quien participa en la sala (fila no rechazada) y al propio actor,
   * que así relee aunque acabe de rechazar. Nadie más recibe nada.
   */
  const changed = (roomId: string): void => {
    const audience = new Set(
      membersOf(roomId)
        .filter((member) => member.status !== 'rechazada')
        .map((member) => member.profileId)
    );
    audience.add(actorId);
    audience.forEach((profileId) => store.notify(roomsTopic(profileId)));
  };

  return {
    async listLive() {
      const now = mockNowMs();
      return getState()
        .rooms.filter((room) => isRoomLive(room, now))
        .flatMap((room) => {
          const me = myRow(room.id);
          return me ? [toView(room, me)] : [];
        })
        .sort(
          (a, b) =>
            Date.parse(a.room.startsAt) - Date.parse(b.room.startsAt) ||
            (a.room.id < b.room.id ? -1 : a.room.id > b.room.id ? 1 : 0)
        );
    },

    async getById(roomId) {
      const room = getState().rooms.find((candidate) => candidate.id === roomId);
      const me = room ? myRow(roomId) : null;
      return room && me ? toView(room, me) : null;
    },

    async create({ inviteeIds, startsAt, blocks }) {
      const inviteError = validateRoomInvitees(inviteeIds, actorId, matchIdsOfActor());
      if (inviteError) throw inviteError;
      const now = mockNowMs();
      const startsAtMs = Date.parse(startsAt);
      if (!isSessionBlocks(blocks) || !isValidStartsAt(startsAtMs, now)) {
        throw new SessionWindowError('Hora o duración fuera de rango');
      }

      const state = getState();
      const room: LockInRoom = {
        id: store.createId('room'),
        hostId: actorId,
        startsAt: iso(startsAtMs),
        blocks,
        cancelledAt: null,
        createdAt: iso(now),
      };
      const host: RoomMember = {
        roomId: room.id,
        profileId: actorId,
        status: 'aceptada',
        respondedAt: iso(now),
        joinedAt: null,
        leftAt: null,
      };
      state.rooms.push(room);
      state.roomMembers.push(
        host,
        ...inviteeIds.map((profileId): RoomMember => ({
          roomId: room.id,
          profileId,
          // Las invitadas bot aceptan en el acto, por el mismo camino que
          // una respuesta real: estado y `respondedAt`.
          status: autoAcceptFrom.has(profileId) ? 'aceptada' : 'invitada',
          respondedAt: autoAcceptFrom.has(profileId) ? iso(now) : null,
          joinedAt: null,
          leftAt: null,
        }))
      );
      changed(room.id);
      return toView(room, host);
    },

    async respond(roomId, answer) {
      const { room, me } = mustSee(roomId);
      if (room.hostId === actorId) {
        throw new SessionForbiddenError('Quien convoca no responde');
      }
      if (room.cancelledAt !== null) throw new SessionConflictError('La sala se canceló');
      // Las respuestas se cierran al abrir la ventana de entrada.
      if (!canRespondToRoom(room, me, mockNowMs())) {
        throw new SessionExpiredError('La ventana de entrada ya está abierta');
      }
      if (me.status !== answer)
        Object.assign(me, { status: answer, respondedAt: iso(mockNowMs()) });
      changed(roomId);
      return { ...me };
    },

    async cancel(roomId) {
      const { room } = mustSee(roomId);
      if (room.hostId !== actorId) throw new SessionForbiddenError('Solo cancela quien convoca');
      if (room.cancelledAt !== null) throw new SessionConflictError('Ya estaba cancelada');
      const now = mockNowMs();
      if (now >= Date.parse(room.startsAt)) throw new SessionExpiredError('Ya ha empezado');
      room.cancelledAt = iso(now);
      changed(roomId);
      return { ...room };
    },

    async join(roomId) {
      const { room, me } = mustSee(roomId);
      if (me.status !== 'aceptada') {
        throw new SessionForbiddenError('No has aceptado la invitación');
      }
      const now = mockNowMs();
      if (!isInRoomJoinWindow(room, me, now)) {
        throw new SessionWindowError('Fuera de la ventana de entrada');
      }
      Object.assign(me, { joinedAt: me.joinedAt ?? iso(now), leftAt: null });
      changed(roomId);
      return { ...me };
    },

    async leave(roomId) {
      const { me } = mustSee(roomId);
      if (me.joinedAt === null) throw new SessionWindowError('No habías entrado en la sala');
      me.leftAt = iso(mockNowMs());
      changed(roomId);
      return { ...me };
    },

    subscribe(listener) {
      return store.subscribeTo(roomsTopic(actorId), listener);
    },
  };
}
