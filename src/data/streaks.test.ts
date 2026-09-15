import { sessionEndsAtMs, type SessionTiming } from './sessions';
import { pairStreak, STREAK_GAP_DAYS } from './streaks';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const START = Date.parse('2026-09-14T18:00:00.000Z');

/** Sesión de 1 bloque (30 min), aceptada: lo mínimo que necesita `pairStreak`. */
function session(startsAtMs: number): SessionTiming {
  return { status: 'aceptada', startsAt: new Date(startsAtMs).toISOString(), blocks: 1 };
}

function endsAt(startsAtMs: number): number {
  return sessionEndsAtMs(new Date(startsAtMs).toISOString(), 1);
}

describe('STREAK_GAP_DAYS', () => {
  it('son 7 días', () => {
    expect(STREAK_GAP_DAYS).toBe(7);
  });
});

describe('pairStreak', () => {
  it('sin sesiones no hay racha', () => {
    expect(pairStreak([], START)).toBeNull();
  });

  it('una sesión sola cuenta 1, viva hasta 7 días después de su fin', () => {
    const s = session(START);
    const e = endsAt(START);

    expect(pairStreak([s], e)).toEqual({ count: 1, aliveUntilMs: e + 7 * DAY });
  });

  it('tres sesiones con huecos de 6 días forman una cadena de 3', () => {
    const s1 = session(START);
    const e1 = endsAt(START);
    const start2 = e1 + 6 * DAY;
    const s2 = session(start2);
    const e2 = endsAt(start2);
    const start3 = e2 + 6 * DAY;
    const s3 = session(start3);
    const e3 = endsAt(start3);

    expect(pairStreak([s1, s2, s3], e3)).toEqual({ count: 3, aliveUntilMs: e3 + 7 * DAY });
  });

  it('un hueco de 7 días exactos entre fin y siguiente inicio rompe la cadena', () => {
    const s1 = session(START);
    const e1 = endsAt(START);
    const start2 = e1 + 7 * DAY;
    const s2 = session(start2);
    const e2 = endsAt(start2);

    expect(pairStreak([s1, s2], e2)).toEqual({ count: 1, aliveUntilMs: e2 + 7 * DAY });
  });

  it('un hueco de 7 días menos 1 ms no rompe la cadena', () => {
    const s1 = session(START);
    const e1 = endsAt(START);
    const start2 = e1 + 7 * DAY - 1;
    const s2 = session(start2);
    const e2 = endsAt(start2);

    expect(pairStreak([s1, s2], e2)).toEqual({ count: 2, aliveUntilMs: e2 + 7 * DAY });
  });

  it('una cadena anterior de 3 no cuenta si se corta: gana la cadena de 1 que sigue', () => {
    const s1 = session(START);
    const e1 = endsAt(START);
    const s2 = session(e1 + 6 * DAY);
    const e2 = endsAt(e1 + 6 * DAY);
    const s3 = session(e2 + 6 * DAY);
    const e3 = endsAt(e2 + 6 * DAY);
    // Corte: más de 7 días desde el fin de la última sesión de la primera cadena.
    const start4 = e3 + 8 * DAY;
    const s4 = session(start4);
    const e4 = endsAt(start4);

    expect(pairStreak([s1, s2, s3, s4], e4)).toEqual({ count: 1, aliveUntilMs: e4 + 7 * DAY });
  });

  it('viva justo antes de aliveUntil, muerta justo en aliveUntil', () => {
    const s = session(START);
    const e = endsAt(START);
    const aliveUntil = e + 7 * DAY;

    expect(pairStreak([s], aliveUntil - 1)).toEqual({ count: 1, aliveUntilMs: aliveUntil });
    expect(pairStreak([s], aliveUntil)).toBeNull();
  });

  it('el orden de entrada no importa: las mismas sesiones desordenadas dan el mismo resultado', () => {
    const s1 = session(START);
    const e1 = endsAt(START);
    const s2 = session(e1 + 6 * DAY);
    const e2 = endsAt(e1 + 6 * DAY);
    const s3 = session(e2 + 6 * DAY);
    const e3 = endsAt(e2 + 6 * DAY);

    const ordered = pairStreak([s1, s2, s3], e3);
    const shuffled = pairStreak([s3, s1, s2], e3);

    expect(shuffled).toEqual(ordered);
  });
});
