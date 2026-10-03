/**
 * Reglas de las salas Lock-In grupales (Fase 3).
 *
 * Una sola fuente para el mock, el repositorio de Supabase y la UI. El SQL de
 * `supabase/migrations/20261002000100_lockin_rooms.sql` repite estas mismas
 * reglas en sus RPC: si cambia una, cambian las dos. Las reglas de tiempo son
 * las de las sesiones 1:1 (`./sessions.ts`), que se importan y no se copian.
 */

import { JOIN_WINDOW_MINUTES, sessionEndsAtMs } from './sessions';

import type { LockInRoom, RoomMember } from './types';

export const ROOM_MIN_INVITEES = 2;
export const ROOM_MAX_INVITEES = 4;

const MINUTE = 60_000;

/**
 * Invitados inválidos al convocar: menos de 2 o más de 4, repetidos, tú entre
 * ellos, o alguno que no es match tuyo. `LI006` en Supabase.
 */
export class RoomInviteError extends Error {
  override name = 'RoomInviteError';
}

type RoomTiming = Pick<LockInRoom, 'startsAt' | 'blocks' | 'cancelledAt'>;

export function roomEndsAtMs(room: Pick<LockInRoom, 'startsAt' | 'blocks'>): number {
  return sessionEndsAtMs(room.startsAt, room.blocks);
}

/** Viva: no cancelada y sin terminar. */
export function isRoomLive(room: RoomTiming, nowMs: number): boolean {
  return room.cancelledAt === null && nowMs < roomEndsAtMs(room);
}

/** Se entra desde 5 minutos antes hasta el final, solo si has aceptado. */
export function isInRoomJoinWindow(
  room: RoomTiming,
  me: Pick<RoomMember, 'status'>,
  nowMs: number
): boolean {
  return (
    me.status === 'aceptada' &&
    room.cancelledAt === null &&
    nowMs >= Date.parse(room.startsAt) - JOIN_WINDOW_MINUTES * MINUTE &&
    nowMs < roomEndsAtMs(room)
  );
}

/**
 * Responde quien está invitada o aceptada, sin convocar, **antes de que abra
 * la ventana de entrada**. Cerrar las respuestas al abrirla es lo que impide
 * que alguien rechace con el canal de presencia ya autorizado (spec, «Presencia
 * y revocación»).
 */
export function canRespondToRoom(
  room: RoomTiming & Pick<LockInRoom, 'hostId'>,
  me: Pick<RoomMember, 'status' | 'profileId'>,
  nowMs: number
): boolean {
  return (
    room.hostId !== me.profileId &&
    me.status !== 'rechazada' &&
    room.cancelledAt === null &&
    nowMs < Date.parse(room.startsAt) - JOIN_WINDOW_MINUTES * MINUTE
  );
}

/** Cancela solo quien convoca, antes de empezar. */
export function canCancelRoom(
  room: RoomTiming & Pick<LockInRoom, 'hostId'>,
  actorId: string,
  nowMs: number
): boolean {
  return room.hostId === actorId && room.cancelledAt === null && nowMs < Date.parse(room.startsAt);
}

/** `null` si los invitados son válidos; si no, el error que lanzar. */
export function validateRoomInvitees(
  inviteeIds: readonly string[],
  actorId: string,
  matchIds: ReadonlySet<string>
): RoomInviteError | null {
  if (inviteeIds.length < ROOM_MIN_INVITEES || inviteeIds.length > ROOM_MAX_INVITEES) {
    return new RoomInviteError(
      `Una sala lleva de ${ROOM_MIN_INVITEES} a ${ROOM_MAX_INVITEES} invitados.`
    );
  }
  if (new Set(inviteeIds).size !== inviteeIds.length) {
    return new RoomInviteError('Hay un invitado repetido.');
  }
  if (inviteeIds.includes(actorId)) return new RoomInviteError('No puedes invitarte a ti.');
  if (inviteeIds.some((id) => !matchIds.has(id))) {
    return new RoomInviteError('Solo puedes invitar a tus matches.');
  }
  return null;
}
