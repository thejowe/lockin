/**
 * Tests de la complementariedad.
 *
 * Es una intersección, así que lo interesante no es el caso feliz sino las dos
 * invariantes que la tarjeta se apoya en que se cumplan: un perfil de `lockin`
 * nunca complementa (no se elige por skills) y un `seekingSpecialties` vacío
 * significa «abierto a cualquiera», no «encajas con todo».
 */

import { buildProfile } from '@/data/test-fixtures';

import { complementWith } from './complement';

describe('complementWith', () => {
  it('devuelve lo que el perfil busca y quien mira ya domina', () => {
    const profile = buildProfile({
      lookingFor: 'par',
      seekingSpecialties: ['marketing', 'ventas'],
    });

    expect(complementWith(profile, ['ventas', 'legal'])).toEqual(['ventas']);
  });

  it('respeta el orden en que el perfil declaró lo que busca', () => {
    const profile = buildProfile({
      lookingFor: 'par',
      seekingSpecialties: ['marketing', 'ventas'],
    });

    expect(complementWith(profile, ['ventas', 'marketing'])).toEqual(['marketing', 'ventas']);
  });

  it('sin nada en común devuelve vacío', () => {
    const profile = buildProfile({ lookingFor: 'ambos', seekingSpecialties: ['dev'] });

    expect(complementWith(profile, ['legal'])).toEqual([]);
  });

  it('un perfil de lock-in nunca complementa, aunque traiga datos viejos', () => {
    // `seekingSpecialties` explícito rompe a propósito la invariante: la señal
    // se decide por `lookingFor`, no por si el array trae algo.
    const profile = buildProfile({ lookingFor: 'lockin', seekingSpecialties: ['dev'] });

    expect(complementWith(profile, ['dev'])).toEqual([]);
  });

  it('«abierto a cualquiera» no es encajar con todo', () => {
    const profile = buildProfile({ lookingFor: 'par', seekingSpecialties: [] });

    expect(complementWith(profile, ['dev', 'marketing'])).toEqual([]);
  });

  it('sin especialidades propias no hay señal', () => {
    const profile = buildProfile({ lookingFor: 'par', seekingSpecialties: ['dev'] });

    expect(complementWith(profile, [])).toEqual([]);
  });
});
