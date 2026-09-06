/**
 * Formato de fechas del chat.
 *
 * Implementado con los getters de `Date` en vez de `Intl`: el resultado es el
 * mismo en iOS, Android y web, y no depende de qué locales traiga el motor JS.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

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

  if (elapsed < MINUTE) return 'ahora';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min`;

  if (isSameDay(date, now)) return formatClock(iso);

  const yesterday = new Date(now.getTime() - DAY);
  if (isSameDay(date, yesterday)) return 'ayer';

  if (elapsed < 7 * DAY) return WEEKDAYS[date.getDay()];

  return `${date.getDate()} ${shortMonth(date)}`;
}

/** Separador de día dentro de la conversación: `Hoy`, `Ayer`, `martes 3 de marzo`. */
export function formatDayHeading(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (isSameDay(date, now)) return 'Hoy';
  if (isSameDay(date, new Date(now.getTime() - DAY))) return 'Ayer';
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} de ${longMonth(date)}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const MONTHS_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

const MONTHS_LONG = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function shortMonth(date: Date): string {
  return MONTHS_SHORT[date.getMonth()];
}

function longMonth(date: Date): string {
  return MONTHS_LONG[date.getMonth()];
}

/** ¿Caen dos marcas de tiempo en el mismo día natural? Decide los separadores de la conversación. */
export function isSameDayIso(a: string, b: string): boolean {
  return isSameDay(new Date(a), new Date(b));
}
