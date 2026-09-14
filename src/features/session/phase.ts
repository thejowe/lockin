/**
 * Fase del Pomodoro compartido.
 *
 * Función pura de la hora: cada dispositivo la evalúa con su reloj corregido y
 * los dos ven lo mismo sin mandarse nada por la red. No hay pausa (spec,
 * decisión "plan fijo, sin pausa").
 */

import { BLOCK_MINUTES, WORK_MINUTES } from '@/data';

import type { SessionBlocks } from '@/data';

export type PhaseKind = 'antes' | 'trabajo' | 'descanso' | 'terminada';

export interface Phase {
  kind: PhaseKind;
  /** Bloque en curso, desde 1. `0` antes de empezar; `blocks` al terminar. */
  block: number;
  /** Lo que falta para el siguiente cambio de fase. `0` al terminar. */
  remainingMs: number;
}

const MINUTE = 60_000;

export function phaseAt(startsAt: string, blocks: SessionBlocks, nowMs: number): Phase {
  const start = Date.parse(startsAt);
  if (nowMs < start) return { kind: 'antes', block: 0, remainingMs: start - nowMs };

  const blockMs = BLOCK_MINUTES * MINUTE;
  const elapsed = nowMs - start;
  const index = Math.floor(elapsed / blockMs);
  if (index >= blocks) return { kind: 'terminada', block: blocks, remainingMs: 0 };

  const withinBlock = elapsed - index * blockMs;
  const workMs = WORK_MINUTES * MINUTE;
  if (withinBlock < workMs) {
    return { kind: 'trabajo', block: index + 1, remainingMs: workMs - withinBlock };
  }
  return { kind: 'descanso', block: index + 1, remainingMs: blockMs - withinBlock };
}

/** `m:ss`, redondeando hacia arriba: no se enseña "0:00" mientras quede tiempo. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(ms, 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
