/**
 * Tests del formato de fechas del chat.
 *
 * `formatRelative` y `formatDayHeading` deciden en cascada: primero por minutos
 * transcurridos, luego por día natural, luego por semana. Cada rama tiene un
 * borde fácil de romper — "ayer a las 23:55" son 15 minutos pero es otro día —
 * así que cada uno tiene aquí su caso.
 *
 * Las fechas se construyen con el constructor local (`new Date(y, m, d, …)`) y
 * se pasan como ISO: así el test dice lo mismo en cualquier zona horaria, igual
 * que hace el módulo usando los getters locales de `Date`.
 */

import { formatClock, formatDayHeading, formatRelative, isSameDayIso } from './format';

/** ISO de una hora local concreta. El mes es 0-indexado, como en `Date`. */
function at(year: number, month: number, day: number, hours = 0, minutes = 0): string {
  return new Date(year, month, day, hours, minutes).toISOString();
}

/** Martes 3 de marzo de 2026, 21:04 local. El "ahora" de casi todos los casos. */
const NOW = new Date(2026, 2, 3, 21, 4);

describe('formatClock', () => {
  it('rellena hora y minuto a dos dígitos', () => {
    expect(formatClock(at(2026, 2, 3, 9, 5))).toBe('09:05');
  });

  it('usa reloj de 24 horas', () => {
    expect(formatClock(at(2026, 2, 3, 21, 4))).toBe('21:04');
  });

  it('la medianoche es 00:00, no 24:00', () => {
    expect(formatClock(at(2026, 2, 3, 0, 0))).toBe('00:00');
  });
});

describe('formatRelative', () => {
  it('menos de un minuto es "ahora"', () => {
    expect(formatRelative(NOW.toISOString(), NOW)).toBe('ahora');
    expect(formatRelative(new Date(NOW.getTime() - 59_000).toISOString(), NOW)).toBe('ahora');
  });

  it('el minuto exacto ya cuenta como minuto', () => {
    expect(formatRelative(new Date(NOW.getTime() - 60_000).toISOString(), NOW)).toBe('1 min');
  });

  it('trunca los minutos hacia abajo', () => {
    expect(formatRelative(new Date(NOW.getTime() - 14 * 60_000 - 59_000).toISOString(), NOW)).toBe(
      '14 min'
    );
  });

  it('a partir de la hora, y dentro del mismo día, muestra el reloj', () => {
    expect(formatRelative(at(2026, 2, 3, 8, 30), NOW)).toBe('08:30');
  });

  it('la hora exacta ya salta al reloj', () => {
    expect(formatRelative(new Date(NOW.getTime() - 3_600_000).toISOString(), NOW)).toBe('20:04');
  });

  it('el día anterior es "ayer" aunque hayan pasado pocas horas', () => {
    expect(formatRelative(at(2026, 2, 2, 23, 50), NOW)).toBe('ayer');
  });

  it('dentro de la última hora manda el reloj, no el día natural', () => {
    // Justo pasada la medianoche: son 15 minutos, aunque el mensaje sea de ayer.
    const midnight = new Date(2026, 2, 3, 0, 10);
    expect(formatRelative(at(2026, 2, 2, 23, 55), midnight)).toBe('15 min');
  });

  it('dentro de la semana muestra el día de la semana', () => {
    expect(formatRelative(at(2026, 1, 28, 12, 0), NOW)).toBe('sábado');
  });

  it('a partir de la semana muestra día y mes abreviado', () => {
    expect(formatRelative(at(2026, 1, 24, 12, 0), NOW)).toBe('24 feb');
  });

  it('mantiene el mes correcto en un salto de año', () => {
    expect(formatRelative(at(2025, 11, 31, 12, 0), NOW)).toBe('31 dic');
  });

  it('una fecha futura no revienta: cae en "ahora"', () => {
    expect(formatRelative(at(2026, 2, 4, 10, 0), NOW)).toBe('ahora');
  });
});

describe('formatDayHeading', () => {
  it('el día en curso es "Hoy"', () => {
    expect(formatDayHeading(at(2026, 2, 3, 1, 0), NOW)).toBe('Hoy');
  });

  it('el día anterior es "Ayer"', () => {
    expect(formatDayHeading(at(2026, 2, 2, 23, 59), NOW)).toBe('Ayer');
  });

  it('cualquier otro día se escribe entero', () => {
    expect(formatDayHeading(at(2026, 1, 24, 12, 0), NOW)).toBe('martes 24 de febrero');
  });

  it('"Ayer" cruza el cambio de mes', () => {
    const firstOfMarch = new Date(2026, 2, 1, 9, 0);
    expect(formatDayHeading(at(2026, 1, 28, 22, 0), firstOfMarch)).toBe('Ayer');
  });
});

describe('isSameDayIso', () => {
  it('es cierto para dos horas del mismo día', () => {
    expect(isSameDayIso(at(2026, 2, 3, 0, 0), at(2026, 2, 3, 23, 59))).toBe(true);
  });

  it('es falso para días consecutivos', () => {
    expect(isSameDayIso(at(2026, 2, 3, 23, 59), at(2026, 2, 4, 0, 0))).toBe(false);
  });

  it('es falso para el mismo día de otro año', () => {
    expect(isSameDayIso(at(2025, 2, 3, 12, 0), at(2026, 2, 3, 12, 0))).toBe(false);
  });
});
