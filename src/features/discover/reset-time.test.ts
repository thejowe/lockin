import { clockOf, untilLabel } from './reset-time';

/** Fechas en hora local del dispositivo, para que el test no dependa de la zona. */
const NOW = new Date(2026, 9, 30, 21, 50);

function local(day: number, hour: number, minute: number, month = 9): string {
  return new Date(2026, month, day, hour, minute).toISOString();
}

describe('untilLabel', () => {
  it('si es hoy, solo la hora', () => {
    expect(untilLabel(local(30, 23, 45), NOW)).toBe('las 23:45');
  });

  it('si es mañana, lo dice', () => {
    expect(untilLabel(local(31, 21, 45), NOW)).toBe('mañana a las 21:45');
  });

  it('casi un día entero después sigue siendo mañana, no hoy', () => {
    expect(untilLabel(local(31, 21, 45), new Date(2026, 9, 30, 21, 46))).toBe('mañana a las 21:45');
  });

  it('más allá de mañana, la fecha corta', () => {
    expect(untilLabel(local(6, 8, 5, 10), NOW)).toMatch(/^el 6 de noviembre a las 08:05$/);
  });

  it('cruza fin de mes: el 31 a mañana es el 1', () => {
    expect(untilLabel(local(1, 9, 0, 10), new Date(2026, 9, 31, 23, 0))).toBe('mañana a las 09:00');
  });
});

describe('clockOf', () => {
  it('rellena con ceros', () => {
    expect(clockOf(local(30, 7, 3))).toBe('07:03');
  });
});
