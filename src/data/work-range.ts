import type { Availability, TimeBand } from './types';
import { t } from '@/i18n';

/** Minutos desde medianoche en la zona del perfil. Solo el fin puede ser 24:00. */
export interface WorkRange {
  startMin: number;
  endMin: number;
}

export const DAY_TICKS = [0, 6, 12, 20, 24] as const;
const BANDS: readonly TimeBand[] = ['madrugada', 'manana', 'tarde', 'noche'];

export function formatWorkMinute(minute: number): string {
  const hour = Math.floor(minute / 60);
  return `${String(hour).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

function validateWorkRange({ startMin, endMin }: WorkRange): void {
  if (
    !Number.isInteger(startMin) ||
    !Number.isInteger(endMin) ||
    startMin % 30 !== 0 ||
    endMin % 30 !== 0 ||
    startMin < 0 ||
    endMin > 24 * 60 ||
    endMin - startMin < 60
  ) {
    throw new RangeError(t('Elige al menos una hora en pasos de media hora.'));
  }
}

export function bandsForRanges(ranges: readonly WorkRange[]): TimeBand[] {
  if (!ranges.length) throw new RangeError(t('Marca al menos una franja horaria.'));
  ranges.forEach(validateWorkRange);
  const [first, second] = ranges;
  if (
    ranges.length > 2 ||
    (second && first.startMin < second.endMin && second.startMin < first.endMin)
  ) {
    throw new RangeError(t('Elige como máximo dos tramos sin solaparlos.'));
  }
  return BANDS.filter((_, i) =>
    ranges.some(
      ({ startMin, endMin }) => startMin < DAY_TICKS[i + 1] * 60 && endMin > DAY_TICKS[i] * 60
    )
  );
}

/** Las franjas antiguas se guardaban en orden de selección y podían tener huecos. */
export function rangesFromBands(bands: readonly TimeBand[]): WorkRange[] {
  const ranges: WorkRange[] = [];
  BANDS.forEach((band, i) => {
    if (!bands.includes(band)) return;
    const startMin = DAY_TICKS[i] * 60;
    const endMin = DAY_TICKS[i + 1] * 60;
    const previous = ranges[ranges.length - 1];
    if (previous?.endMin === startMin) previous.endMin = endMin;
    else ranges.push({ startMin, endMin });
  });
  if (!ranges.length) throw new RangeError(t('Marca al menos una franja horaria.'));
  return ranges;
}

export function availabilityForRanges(
  hoursPerWeek: number,
  ranges: readonly WorkRange[]
): Availability {
  return {
    hoursPerWeek,
    bands: bandsForRanges(ranges),
    ranges: ranges.map((range) => ({ ...range })).sort((a, b) => a.startMin - b.startMin),
  };
}
