/** La jornada es recurrente. Se proyecta con el desfase vigente entre ambas zonas. */
import type { WorkRange } from '@/data/work-range';

const DAY_MINUTES = 24 * 60;

export interface DaySchedule {
  ranges: WorkRange[];
  timezone: string;
}

/** Las piezas de un mismo tramo, en el orden en el que transcurren. */
export type DayPeriod = readonly [WorkRange] | readonly [WorkRange, WorkRange];

/** Basta el minuto del reloj: al proyectar sobre 24 h, el día del calendario se descarta. */
function clockMinute(timeZone: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instant);
  const value = (type: 'hour' | 'minute') =>
    Number(parts.find((part) => part.type === type)?.value);
  return value('hour') * 60 + value('minute');
}

/** Un tramo al final y otro al principio si el horario cruza medianoche al convertirlo. */
export function projectRanges(
  ranges: WorkRange[],
  source: string,
  destination: string,
  instant: Date
): DayPeriod[] | null {
  let shift = 0;
  try {
    if (source !== destination) {
      shift = clockMinute(destination, instant) - clockMinute(source, instant);
    }
  } catch {
    // Los perfiles antiguos admitían zonas en texto libre. Nunca las tomamos por UTC.
    return null;
  }
  return ranges.map((range) => {
    const duration = range.endMin - range.startMin;
    if (shift === 0 || duration === DAY_MINUTES) return [range];
    const startMin = (range.startMin + shift + DAY_MINUTES) % DAY_MINUTES;
    const endMin = startMin + duration;
    if (endMin <= DAY_MINUTES) return [{ startMin, endMin }];
    return [
      { startMin, endMin: DAY_MINUTES },
      { startMin: 0, endMin: endMin - DAY_MINUTES },
    ];
  });
}

/** Solo se reúnen los extremos que pertenecen al mismo par de tramos. */
export function sharedPeriods(worked: DayPeriod[], viewer: DayPeriod[]): DayPeriod[] {
  return worked.flatMap((workPeriod) =>
    viewer.flatMap((viewerPeriod): DayPeriod[] => {
      const intersections = workPeriod
        .flatMap((work) =>
          viewerPeriod.map((own) => ({
            startMin: Math.max(work.startMin, own.startMin),
            endMin: Math.min(work.endMin, own.endMin),
          }))
        )
        .filter(({ startMin, endMin }) => startMin < endMin)
        .sort((a, b) => a.startMin - b.startMin);
      const first = intersections[0];
      const last = intersections[intersections.length - 1];
      if (intersections.length > 1 && first.startMin === 0 && last.endMin === DAY_MINUTES) {
        const middle = intersections.slice(1, -1).map((piece): DayPeriod => [piece]);
        return [[last, first], ...middle];
      }
      return intersections.map((piece) => [piece]);
    })
  );
}
