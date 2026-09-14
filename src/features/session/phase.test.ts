/** Fase del Pomodoro compartido en cada instante, con sus bordes al milisegundo. */

import { formatCountdown, phaseAt } from './phase';

const MINUTE = 60_000;
const START = Date.parse('2026-09-14T18:00:00.000Z');
const startsAt = new Date(START).toISOString();

describe('phaseAt', () => {
  it('antes de empezar cuenta lo que falta', () => {
    expect(phaseAt(startsAt, 2, START - 90_000)).toEqual({
      kind: 'antes',
      block: 0,
      remainingMs: 90_000,
    });
  });

  it('en la hora exacta empieza el trabajo del bloque 1', () => {
    expect(phaseAt(startsAt, 2, START)).toEqual({
      kind: 'trabajo',
      block: 1,
      remainingMs: 25 * MINUTE,
    });
  });

  it('pasa a descanso a los 25 minutos exactos, no antes', () => {
    expect(phaseAt(startsAt, 2, START + 25 * MINUTE - 1)).toEqual({
      kind: 'trabajo',
      block: 1,
      remainingMs: 1,
    });
    expect(phaseAt(startsAt, 2, START + 25 * MINUTE)).toEqual({
      kind: 'descanso',
      block: 1,
      remainingMs: 5 * MINUTE,
    });
  });

  it('a los 30 minutos empieza el trabajo del bloque siguiente', () => {
    expect(phaseAt(startsAt, 2, START + 30 * MINUTE)).toEqual({
      kind: 'trabajo',
      block: 2,
      remainingMs: 25 * MINUTE,
    });
  });

  it('al cumplir todos los bloques está terminada, incluido el último descanso', () => {
    expect(phaseAt(startsAt, 2, START + 60 * MINUTE - 1).kind).toBe('descanso');
    expect(phaseAt(startsAt, 2, START + 60 * MINUTE)).toEqual({
      kind: 'terminada',
      block: 2,
      remainingMs: 0,
    });
  });
});

describe('formatCountdown', () => {
  it.each([
    [25 * MINUTE, '25:00'],
    [59_001, '1:00'],
    [1, '0:01'],
    [0, '0:00'],
  ])('%i ms se muestra como %s, redondeando hacia arriba al segundo', (ms, expected) => {
    expect(formatCountdown(ms)).toBe(expected);
  });
});
