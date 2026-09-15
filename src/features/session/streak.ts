/**
 * Qué se pinta de la racha de pareja, y sus textos. Pura: la hora entra como
 * parámetro, como en `card-state.ts`.
 *
 * Nunca lee `session_ratings`: la racha entra ya calculada desde `@/data` y
 * esto solo decide si se muestra y con qué palabras.
 */

import { formatStartsIn } from './format';

import type { MatchStreak } from '@/data';

/** "Racha 1" no dice nada que la tarjeta no diga ya. */
export const STREAK_MIN_VISIBLE = 2;

/** El número a pintar, o `null`. Caduca en pantalla sin volver a pedir datos. */
export function visibleStreak(
  streak: MatchStreak | null | undefined,
  nowMs: number
): number | null {
  if (!streak || streak.count < STREAK_MIN_VISIBLE) return null;
  return nowMs < Date.parse(streak.aliveUntil) ? streak.count : null;
}

/** Etiqueta corta de la fila de Matches. */
export const streakTag = (count: number) => `· Racha ${count}`;

/** Línea de la tarjeta, y también del `accessibilityLabel` de la fila. */
export const streakLine = (count: number) => `Racha de ${count} sesiones seguidas`;

/**
 * "Sin sesión, se rompe en 6 días". Relativo y no con día de la semana: una
 * racha que acaba de sumar caduca el mismo día de la semana siguiente, y
 * `formatSessionWhen` lo pintaría como si fuera hoy.
 */
export const streakDeadline = (streak: MatchStreak, nowMs: number) =>
  `Sin sesión, se rompe ${formatStartsIn(Date.parse(streak.aliveUntil) - nowMs)}`;
