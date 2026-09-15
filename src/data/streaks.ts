/**
 * Regla de las rachas de pareja.
 *
 * Una sola fuente para el mock y la UI. El SQL de
 * `supabase/migrations/20260915000200_match_streaks.sql` la repite en
 * `match_streaks()`: si cambia una, cambian las dos.
 */

import { sessionEndsAtMs, type SessionTiming } from './sessions';

export const STREAK_GAP_DAYS = 7;

const GAP_MS = STREAK_GAP_DAYS * 24 * 60 * 60_000;

/**
 * Longitud de la última cadena de sesiones seguidas, o `null` si no hay o ya
 * caducó. `shared` son las sesiones que ya cuentan (aceptadas y con las dos
 * personas dentro): filtrarlas es cosa de cada backend. Da igual el orden.
 */
export function pairStreak(
  shared: readonly SessionTiming[],
  nowMs: number
): { count: number; aliveUntilMs: number } | null {
  const ordered = [...shared].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  let count = 0;
  let lastEndsAt = -Infinity;
  for (const session of ordered) {
    const startsAt = Date.parse(session.startsAt);
    count = startsAt - lastEndsAt < GAP_MS ? count + 1 : 1;
    lastEndsAt = sessionEndsAtMs(session.startsAt, session.blocks);
  }
  if (count === 0 || nowMs >= lastEndsAt + GAP_MS) return null;
  return { count, aliveUntilMs: lastEndsAt + GAP_MS };
}
