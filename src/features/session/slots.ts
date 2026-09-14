/**
 * Días y horas que se pueden proponer, y la hora que llega preseleccionada.
 *
 * Todo en hora local del dispositivo. La franja común solo se usa si las dos
 * personas declaran la misma zona horaria: `Availability.bands` es local de cada
 * perfil, y cruzarlas entre zonas daría horas que no son de nadie.
 */

import { MIN_LEAD_MINUTES } from '@/data';

import type { Profile, TimeBand } from '@/data';

export const SLOT_MINUTES = 15;
/** La interfaz ofrece una semana; el límite de 30 días lo pone el servidor. */
export const PROPOSAL_DAYS = 7;

/** Espejo de las descripciones de `TIME_BAND_OPTIONS` (un test lo fija). */
export const BAND_START_HOUR: Record<TimeBand, number> = {
  madrugada: 0,
  manana: 6,
  tarde: 12,
  noche: 20,
};
export const BAND_END_HOUR: Record<TimeBand, number> = {
  madrugada: 6,
  manana: 12,
  tarde: 20,
  noche: 24,
};

const BAND_ORDER: TimeBand[] = ['madrugada', 'manana', 'tarde', 'noche'];
const MINUTE = 60_000;

export function startOfDayMs(ms: number): number {
  const day = new Date(ms);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

export function dayOptions(nowMs: number, days = PROPOSAL_DAYS): number[] {
  const today = new Date(startOfDayMs(nowMs));
  return Array.from({ length: days }, (_, offset) =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset).getTime()
  );
}

/** Tramos de 15 min del día que caen a partir de ahora + 5 min. */
export function slotsForDay(dayStartMs: number, nowMs: number): number[] {
  const earliest = nowMs + MIN_LEAD_MINUTES * MINUTE;
  const day = new Date(dayStartMs);
  const slots: number[] = [];
  for (let minute = 0; minute < 24 * 60; minute += SLOT_MINUTES) {
    const slot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minute).getTime();
    if (slot >= earliest) slots.push(slot);
  }
  return slots;
}

export function sharedBands(me: Profile | null, other: Profile): TimeBand[] {
  if (!me || me.timezone !== other.timezone) return [];
  return BAND_ORDER.filter(
    (band) => me.availability.bands.includes(band) && other.availability.bands.includes(band)
  );
}

function inBand(slotMs: number, band: TimeBand): boolean {
  const date = new Date(slotMs);
  const hour = date.getHours() + date.getMinutes() / 60;
  return hour >= BAND_START_HOUR[band] && hour < BAND_END_HOUR[band];
}

/** El primer tramo válido dentro de una franja común; si no hay, el primer tramo válido. */
export function preselectSlot(me: Profile | null, other: Profile, nowMs: number): number {
  const bands = sharedBands(me, other);
  const days = dayOptions(nowMs);

  for (const day of days) {
    const slots = slotsForDay(day, nowMs);
    const found = slots.find((slot) => bands.some((band) => inBand(slot, band)));
    if (found !== undefined) return found;
  }
  for (const day of days) {
    const [first] = slotsForDay(day, nowMs);
    if (first !== undefined) return first;
  }
  return nowMs + MIN_LEAD_MINUTES * MINUTE;
}
