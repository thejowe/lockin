/**
 * Formato de fechas del chat.
 *
 * Implementado con los getters de `Date` en vez de `Intl`: el resultado es el
 * mismo en iOS, Android y web, y no depende de qué locales traiga el motor JS.
 * Los nombres se traducen con `t()`, igual que el resto de textos.
 */

import { t, tk } from '@/i18n';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const WEEKDAYS = [
  tk('domingo'),
  tk('lunes'),
  tk('martes'),
  tk('miércoles'),
  tk('jueves'),
  tk('viernes'),
  tk('sábado'),
];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Hora de un mensaje concreto: `21:04`. */
export function formatClock(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Marca de tiempo de la lista de matches: lo bastante corta para caber a la
 * derecha de un nombre. `ahora` → `14 min` → `21:04` → `martes` → `3 mar`.
 */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const elapsed = now.getTime() - date.getTime();

  if (elapsed < MINUTE) return t('ahora');
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min`;

  if (isSameDay(date, now)) return formatClock(iso);

  const yesterday = new Date(now.getTime() - DAY);
  if (isSameDay(date, yesterday)) return t('ayer');

  if (elapsed < 7 * DAY) return t(WEEKDAYS[date.getDay()]);

  return `${date.getDate()} ${shortMonth(date)}`;
}

/** Separador de día dentro de la conversación: `Hoy`, `Ayer`, `martes 3 de marzo`. */
export function formatDayHeading(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (isSameDay(date, now)) return t('Hoy');
  if (isSameDay(date, new Date(now.getTime() - DAY))) return t('Ayer');
  return t('{weekday} {day} {ofMonth}', {
    weekday: t(WEEKDAYS[date.getDay()]),
    day: date.getDate(),
    ofMonth: t(MONTHS_OF[date.getMonth()]),
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const MONTHS_SHORT = [
  tk('ene'),
  tk('feb'),
  tk('mar'),
  tk('abr'),
  tk('may'),
  tk('jun'),
  tk('jul'),
  tk('ago'),
  tk('sep'),
  tk('oct'),
  tk('nov'),
  tk('dic'),
];

/** Con su «de», porque el catalán lo apostrofa según el mes («d'abril»). */
const MONTHS_OF = [
  tk('de enero'),
  tk('de febrero'),
  tk('de marzo'),
  tk('de abril'),
  tk('de mayo'),
  tk('de junio'),
  tk('de julio'),
  tk('de agosto'),
  tk('de septiembre'),
  tk('de octubre'),
  tk('de noviembre'),
  tk('de diciembre'),
];

function shortMonth(date: Date): string {
  return t(MONTHS_SHORT[date.getMonth()]);
}

/** ¿Caen dos marcas de tiempo en el mismo día natural? Decide los separadores de la conversación. */
export function isSameDayIso(a: string, b: string): boolean {
  return isSameDay(new Date(a), new Date(b));
}
