/**
 * Tests del catálogo de opciones del perfil.
 *
 * El catálogo traduce códigos estables a texto, así que lo que puede romperse
 * en silencio son los caminos de respaldo: un perfil guardado con un código que
 * ya no está en la lista, o una disponibilidad sin franjas. Ninguno de los dos
 * puede acabar pintando un hueco en la tarjeta.
 *
 * `seeksComplement` está aquí porque es la invariante de
 * `Profile.seekingSpecialties` y la comparten formulario, ficha y mappers.
 */

import {
  ambitionLabel,
  availabilitySummary,
  modeLabel,
  seeksComplement,
  specialtyLabel,
  startingPointLabel,
  startingPointSentence,
  timeBandLabel,
} from './catalog';

import type { Ambition, ModePreference, Specialty, StartingPoint, TimeBand } from '@/data';

describe('etiquetas', () => {
  it('traduce cada código a su texto', () => {
    expect(modeLabel('lockin')).toBe('Compañero de Lock-In');
    expect(specialtyLabel('dev')).toBe('Desarrollo');
    expect(startingPointLabel('algo-empezado')).toBe('Algo empezado');
    expect(ambitionLabel('todo-o-nada')).toBe('Apostarlo todo');
    expect(timeBandLabel('manana')).toBe('Mañana');
  });

  it('devuelve el código cuando no está en el catálogo', () => {
    // Un perfil guardado antes de retirar una opción sigue en la base de datos.
    // Pintar el código es feo; pintar un hueco es un perfil que miente.
    expect(specialtyLabel('quantica' as Specialty)).toBe('quantica');
    expect(modeLabel('trio' as ModePreference)).toBe('trio');
    expect(ambitionLabel('sabatico' as Ambition)).toBe('sabatico');
    expect(timeBandLabel('siesta' as TimeBand)).toBe('siesta');
  });
});

describe('startingPointSentence', () => {
  it('usa la frase larga, no la etiqueta corta', () => {
    expect(startingPointSentence('solo-ganas')).toBe(
      'Solo tengo ganas y ambición, sin idea todavía.'
    );
  });

  it('cae a la etiqueta cuando el código no está en el catálogo', () => {
    expect(startingPointSentence('mvp-vendido' as StartingPoint)).toBe('mvp-vendido');
  });
});

describe('availabilitySummary', () => {
  it('dice "sin franja" cuando no hay ninguna', () => {
    // Vacío es posible: `validate` lo exige en el formulario, pero la ficha
    // también pinta perfiles que vienen de la base de datos.
    expect(availabilitySummary(10, [])).toBe('10 h/semana · sin franja');
  });

  it('no mete conjunción con una sola franja', () => {
    expect(availabilitySummary(12, ['noche'])).toBe('12 h/semana · noche');
  });

  it('une dos franjas con "y"', () => {
    expect(availabilitySummary(20, ['tarde', 'noche'])).toBe('20 h/semana · tarde y noche');
  });

  it('separa por comas y deja la "y" solo antes de la última', () => {
    expect(availabilitySummary(35, ['madrugada', 'manana', 'tarde'])).toBe(
      '35 h/semana · madrugada, mañana y tarde'
    );
  });
});

describe('seeksComplement', () => {
  it.each([
    ['par', true],
    ['ambos', true],
    ['lockin', false],
    [null, false],
  ] as [ModePreference | null, boolean][])('%s → %s', (lookingFor, expected) => {
    expect(seeksComplement(lookingFor)).toBe(expected);
  });
});
