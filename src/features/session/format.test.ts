/** Textos de fecha y duración de las sesiones, en hora local. */

import {
  blocksLabel,
  formatDayLabel,
  formatSessionWhen,
  formatStartsIn,
  formatTimeOfDay,
} from './format';

const MINUTE = 60_000;
/** Lunes 14 de septiembre de 2026 a las 10:00, hora local. */
const NOW = new Date(2026, 8, 14, 10, 0).getTime();
const iso = (day: number, hour: number, minute = 0) =>
  new Date(2026, 8, day, hour, minute).toISOString();

describe('formatSessionWhen', () => {
  it.each([
    [iso(14, 18), 'hoy 18:00'],
    [iso(15, 9, 30), 'mañana 09:30'],
    [iso(17, 18), 'jue 18:00'],
  ])('%s se lee como «%s»', (startsAt, expected) => {
    expect(formatSessionWhen(startsAt, NOW)).toBe(expected);
  });
});

describe('formatDayLabel', () => {
  it('nombra hoy, mañana y el resto por día de la semana y número', () => {
    expect(formatDayLabel(new Date(2026, 8, 14).getTime(), NOW)).toBe('Hoy');
    expect(formatDayLabel(new Date(2026, 8, 15).getTime(), NOW)).toBe('Mañana');
    expect(formatDayLabel(new Date(2026, 8, 17).getTime(), NOW)).toBe('jue 17');
  });
});

describe('formatStartsIn', () => {
  it.each([
    [30_000, 'en menos de 1 min'],
    [45 * MINUTE, 'en 45 min'],
    [130 * MINUTE, 'en 2 h'],
    [24 * 60 * MINUTE, 'en 1 día'],
    [3 * 24 * 60 * MINUTE + MINUTE, 'en 3 días'],
  ])('%i ms → «%s»', (ms, expected) => {
    expect(formatStartsIn(ms)).toBe(expected);
  });
});

describe('formatTimeOfDay y blocksLabel', () => {
  it('horas con dos dígitos y bloques en singular y plural', () => {
    expect(formatTimeOfDay(new Date(2026, 8, 14, 9, 5).getTime())).toBe('09:05');
    expect(blocksLabel(1)).toBe('1 bloque');
    expect(blocksLabel(4)).toBe('4 bloques');
  });
});
