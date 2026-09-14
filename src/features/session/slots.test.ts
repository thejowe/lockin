/** Días y horas que ofrece la hoja de propuesta, y qué hora llega preseleccionada. */

import { TIME_BAND_OPTIONS } from '@/features/profile/catalog';
import { buildProfile } from '@/data/test-fixtures';

import {
  BAND_END_HOUR,
  BAND_START_HOUR,
  dayOptions,
  preselectSlot,
  sharedBands,
  slotsForDay,
  startOfDayMs,
} from './slots';

/** Lunes 14 de septiembre de 2026, en hora local. */
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 8, day, hour, minute).getTime();

describe('dayOptions', () => {
  it('ofrece hoy y los 6 días siguientes, cada uno a medianoche local', () => {
    const days = dayOptions(at(14, 10, 7));

    expect(days).toHaveLength(7);
    expect(days[0]).toBe(at(14, 0));
    expect(days[6]).toBe(at(20, 0));
    expect(startOfDayMs(at(14, 23, 59))).toBe(at(14, 0));
  });
});

describe('slotsForDay', () => {
  it('hoy empieza en el primer tramo de 15 min que respeta el margen de 5', () => {
    const slots = slotsForDay(at(14, 0), at(14, 10, 7));

    expect(slots[0]).toBe(at(14, 10, 15));
    expect(slots[slots.length - 1]).toBe(at(14, 23, 45));
  });

  it('un día futuro tiene los 96 tramos desde las 00:00', () => {
    const slots = slotsForDay(at(15, 0), at(14, 10, 7));

    expect(slots).toHaveLength(96);
    expect(slots[0]).toBe(at(15, 0));
  });
});

describe('sharedBands', () => {
  const me = buildProfile({
    timezone: 'Europe/Madrid',
    availability: { hoursPerWeek: 10, bands: ['noche', 'tarde'] },
  });

  it('en la misma zona horaria devuelve las franjas comunes en orden del día', () => {
    const other = buildProfile({
      timezone: 'Europe/Madrid',
      availability: { hoursPerWeek: 5, bands: ['noche', 'tarde', 'manana'] },
    });

    expect(sharedBands(me, other)).toEqual(['tarde', 'noche']);
  });

  it('con zonas distintas no preselecciona nada: las franjas son locales de cada uno', () => {
    const other = buildProfile({
      timezone: 'America/Bogota',
      availability: { hoursPerWeek: 5, bands: ['noche'] },
    });

    expect(sharedBands(me, other)).toEqual([]);
    expect(sharedBands(null, other)).toEqual([]);
  });
});

describe('preselectSlot', () => {
  const me = buildProfile({
    timezone: 'Europe/Madrid',
    availability: { hoursPerWeek: 10, bands: ['noche'] },
  });
  const other = buildProfile({
    timezone: 'Europe/Madrid',
    availability: { hoursPerWeek: 5, bands: ['noche'] },
  });

  it('elige el inicio de la primera franja común de hoy', () => {
    expect(preselectSlot(me, other, at(14, 10, 7))).toBe(at(14, 20, 0));
  });

  it('si la franja ya ha empezado, el siguiente tramo válido dentro de ella', () => {
    expect(preselectSlot(me, other, at(14, 21, 10))).toBe(at(14, 21, 15));
  });

  it('si hoy ya no cabe, la franja común de mañana', () => {
    expect(preselectSlot(me, other, at(14, 23, 50))).toBe(at(15, 20, 0));
  });

  it('sin franja común, el próximo tramo válido', () => {
    const elsewhere = { ...other, timezone: 'America/Bogota' };
    expect(preselectSlot(me, elsewhere, at(14, 10, 7))).toBe(at(14, 10, 15));
  });
});

describe('horas de las franjas', () => {
  it('coinciden con las descripciones del catálogo de perfil', () => {
    for (const option of TIME_BAND_OPTIONS) {
      const [start, end] = (option.description ?? '').split('–').map(Number);
      expect(BAND_START_HOUR[option.value]).toBe(start);
      expect(BAND_END_HOUR[option.value]).toBe(end === 0 ? 24 : end);
    }
  });
});
