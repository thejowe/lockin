/**
 * Reglas puras de qué pintar de la racha, y sus textos.
 */

import { STREAK_MIN_VISIBLE, streakDeadline, streakLine, streakTag, visibleStreak } from './streak';

import type { MatchStreak } from '@/data';

const streak = (count: number, aliveUntil: string): MatchStreak => ({
  matchId: 'm1',
  count,
  aliveUntil,
});

describe('visibleStreak', () => {
  it('null sin racha', () => {
    expect(visibleStreak(null, Date.now())).toBeNull();
  });

  it('undefined sin racha', () => {
    expect(visibleStreak(undefined, Date.now())).toBeNull();
  });

  it('nada por debajo de STREAK_MIN_VISIBLE', () => {
    expect(STREAK_MIN_VISIBLE).toBe(2);
    const now = Date.now();
    const live = streak(1, new Date(now + 60_000).toISOString());
    expect(visibleStreak(live, now)).toBeNull();
  });

  it('el número si la racha está viva', () => {
    const now = Date.now();
    const live = streak(2, new Date(now + 60_000).toISOString());
    expect(visibleStreak(live, now)).toBe(2);
  });

  it('nada justo en el instante de aliveUntil', () => {
    const now = Date.now();
    const dead = streak(2, new Date(now).toISOString());
    expect(visibleStreak(dead, now)).toBeNull();
  });
});

describe('textos', () => {
  it('streakTag', () => {
    expect(streakTag(3)).toBe('· Racha 3');
  });

  it('streakLine', () => {
    expect(streakLine(3)).toBe('Racha de 3 sesiones seguidas');
  });

  it('streakDeadline', () => {
    const now = Date.now();
    const live = streak(2, new Date(now + 6 * 24 * 60 * 60_000).toISOString());
    expect(streakDeadline(live, now)).toBe('Sin sesión, se rompe en 6 días');
  });
});
