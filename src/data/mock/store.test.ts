/**
 * Tests de las funciones puras del store mock.
 *
 * Son las piezas que deciden a quién ves y bajo qué modo nace un match: si
 * `matchesMode` o `resolveMatchMode` se tuercen, el producto entero miente.
 */

import { buildProfile } from '../test-fixtures';
import { initialsFrom, matchesMode, resolveMatchMode } from './store';

import type { ModePreference } from '../types';

const profileWith = (lookingFor: ModePreference) => buildProfile({ lookingFor });

describe('initialsFrom', () => {
  it('toma la primera y la última palabra', () => {
    expect(initialsFrom('Núria Bosch')).toBe('NB');
  });

  it('usa una sola letra cuando solo hay un nombre', () => {
    expect(initialsFrom('Marc')).toBe('M');
  });

  it('ignora los nombres intermedios', () => {
    expect(initialsFrom('Ana María Pérez Gil')).toBe('AG');
  });

  it('tolera espacios de sobra', () => {
    expect(initialsFrom('  alba   riera  ')).toBe('AR');
  });

  it('devuelve "?" si el nombre viene vacío', () => {
    expect(initialsFrom('   ')).toBe('?');
  });
});

describe('matchesMode', () => {
  it('deja pasar todo si quien mira no ha elegido modo', () => {
    expect(matchesMode(profileWith('par'), undefined)).toBe(true);
    expect(matchesMode(profileWith('lockin'), 'ambos')).toBe(true);
  });

  it('deja pasar al que busca lo mismo', () => {
    expect(matchesMode(profileWith('par'), 'par')).toBe(true);
    expect(matchesMode(profileWith('lockin'), 'lockin')).toBe(true);
  });

  it('deja pasar al que está abierto a ambos', () => {
    expect(matchesMode(profileWith('ambos'), 'par')).toBe(true);
    expect(matchesMode(profileWith('ambos'), 'lockin')).toBe(true);
  });

  it('descarta al que busca lo contrario', () => {
    expect(matchesMode(profileWith('lockin'), 'par')).toBe(false);
    expect(matchesMode(profileWith('par'), 'lockin')).toBe(false);
  });
});

describe('resolveMatchMode', () => {
  it('manda el modo concreto cuando solo uno lo declara', () => {
    expect(resolveMatchMode('ambos', 'lockin')).toBe('lockin');
    expect(resolveMatchMode('par', 'ambos')).toBe('par');
  });

  it('respeta el modo de quien mira si ambos son concretos', () => {
    expect(resolveMatchMode('lockin', 'par')).toBe('lockin');
  });

  it('cae a Par cuando los dos dicen "ambos"', () => {
    expect(resolveMatchMode('ambos', 'ambos')).toBe('par');
  });
});
