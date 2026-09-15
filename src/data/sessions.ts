/**
 * Reglas de tiempo de las sesiones Lock-In.
 *
 * Una sola fuente para el mock, el repositorio de Supabase y la UI. El SQL de
 * `supabase/migrations/20260913000100_lockin_sessions.sql` repite estas mismas
 * reglas en `session_is_live()` y en los RPCs: si cambia una, cambian las dos.
 */

import type { LockInSession, SessionAttendance, SessionBlocks } from './types';

export const WORK_MINUTES = 25;
export const BREAK_MINUTES = 5;
export const BLOCK_MINUTES = WORK_MINUTES + BREAK_MINUTES;
export const MIN_LEAD_MINUTES = 5;
export const MAX_LEAD_DAYS = 30;
export const JOIN_WINDOW_MINUTES = 5;
export const RATING_WINDOW_HOURS = 24;
export const SESSION_BLOCK_OPTIONS: readonly SessionBlocks[] = [1, 2, 4];

const MINUTE = 60_000;

/** Lo único que miran las reglas de tiempo. */
export type SessionTiming = Pick<LockInSession, 'status' | 'startsAt' | 'blocks'>;

export function sessionEndsAtMs(startsAt: string, blocks: SessionBlocks): number {
  return Date.parse(startsAt) + blocks * BLOCK_MINUTES * MINUTE;
}

/** Viva: propuesta que aún no ha llegado a su hora, o aceptada que no ha acabado. */
export function isSessionLive(session: SessionTiming, nowMs: number): boolean {
  if (session.status === 'propuesta') return nowMs < Date.parse(session.startsAt);
  if (session.status === 'aceptada') {
    return nowMs < sessionEndsAtMs(session.startsAt, session.blocks);
  }
  return false;
}

/** Se puede entrar desde 5 minutos antes hasta el final, y solo si está aceptada. */
export function isInJoinWindow(session: SessionTiming, nowMs: number): boolean {
  return (
    session.status === 'aceptada' &&
    nowMs >= Date.parse(session.startsAt) - JOIN_WINDOW_MINUTES * MINUTE &&
    nowMs < sessionEndsAtMs(session.startsAt, session.blocks)
  );
}

/** Se valora desde que la sesión termina hasta 24 h después, y solo si se aceptó. */
export function isInRatingWindow(session: SessionTiming, nowMs: number): boolean {
  if (session.status !== 'aceptada') return false;
  const endsAt = sessionEndsAtMs(session.startsAt, session.blocks);
  return nowMs >= endsAt && nowMs < endsAt + RATING_WINDOW_HOURS * 60 * MINUTE;
}

/** Asistió = entró antes de que la sesión acabara. Salirse antes no lo deshace. */
export function attendedSession(
  rows: readonly SessionAttendance[],
  profileId: string,
  session: SessionTiming
): boolean {
  const endsAt = sessionEndsAtMs(session.startsAt, session.blocks);
  return rows.some((row) => row.profileId === profileId && Date.parse(row.joinedAt) < endsAt);
}

export function isValidStartsAt(startsAtMs: number, nowMs: number): boolean {
  return (
    startsAtMs >= nowMs + MIN_LEAD_MINUTES * MINUTE &&
    startsAtMs <= nowMs + MAX_LEAD_DAYS * 24 * 60 * MINUTE
  );
}

export function isSessionBlocks(value: number): value is SessionBlocks {
  return value === 1 || value === 2 || value === 4;
}
