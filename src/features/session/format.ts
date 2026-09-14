/**
 * Textos de fecha y duración de las sesiones, en hora local.
 *
 * A mano y no con `Intl`: las abreviaturas de día de la semana varían entre
 * motores (Hermes, Node, navegador) y la tarjeta necesita leerse igual en todos.
 */

import { startOfDayMs } from './slots';

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MINUTE = 60_000;

const pad = (value: number) => String(value).padStart(2, '0');

export function formatTimeOfDay(ms: number): string {
  const date = new Date(ms);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Días completos entre el día de `ms` y el de `nowMs`, por fecha local y no por horas. */
function dayDistance(ms: number, nowMs: number): number {
  const a = new Date(startOfDayMs(ms));
  const b = new Date(startOfDayMs(nowMs));
  return Math.round(
    (Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) -
      Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) /
      (24 * 60 * MINUTE)
  );
}

/** Etiqueta de un día en la hoja de propuesta: "Hoy", "Mañana", "jue 17". */
export function formatDayLabel(dayStartMs: number, nowMs: number): string {
  const distance = dayDistance(dayStartMs, nowMs);
  if (distance === 0) return 'Hoy';
  if (distance === 1) return 'Mañana';
  const date = new Date(dayStartMs);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}`;
}

/** "hoy 18:00", "mañana 09:30", "jue 18:00". */
export function formatSessionWhen(startsAt: string, nowMs: number): string {
  const ms = Date.parse(startsAt);
  const distance = dayDistance(ms, nowMs);
  const day = distance === 0 ? 'hoy' : distance === 1 ? 'mañana' : WEEKDAYS[new Date(ms).getDay()];
  return `${day} ${formatTimeOfDay(ms)}`;
}

/** "en 45 min", "en 2 h", "en 3 días". Trunca: nunca promete menos espera de la real. */
export function formatStartsIn(ms: number): string {
  if (ms < MINUTE) return 'en menos de 1 min';
  const minutes = Math.floor(ms / MINUTE);
  if (minutes < 60) return `en ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `en ${hours} h`;
  const days = Math.floor(hours / 24);
  return `en ${days} ${days === 1 ? 'día' : 'días'}`;
}

export function blocksLabel(blocks: number): string {
  return `${blocks} ${blocks === 1 ? 'bloque' : 'bloques'}`;
}
