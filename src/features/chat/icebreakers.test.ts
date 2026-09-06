/**
 * Tests de los icebreakers sugeridos.
 *
 * Son reglas puras sobre dos perfiles, evaluadas de más específica a más
 * genérica y recortadas a tres: el orden del módulo *es* la prioridad, así que
 * aquí se comprueban dos cosas distintas — que cada regla dispara con los datos
 * que le tocan y calla con los que no, y que cuando varias aplican salen en el
 * orden prometido.
 *
 * Las frases se escriben literales en vez de importar las constantes: el texto
 * es el producto, y un test que se limite a repetir la implementación no
 * detectaría que alguien lo cambia sin querer.
 *
 * Para aislar una regla hay que anular las anteriores. Los dos trucos que se
 * repiten:
 * - `specialties: []` en el perfil propio deja a la vez sin efecto
 *   `complementarySpecialties` (no hay nada "solo mío") y `sharedSpecialties`
 *   (no hay solapamiento).
 * - `prompts: []` en el otro perfil calla `quoteTheirPrompt`, que si no se cuela
 *   en el recorte de tres.
 */

import { buildProfile } from '@/data/test-fixtures';

import { suggestIcebreakers } from './icebreakers';

import type { Profile } from '@/data';

/** El perfil propio de referencia. Sin prompts porque los suyos no se citan nunca. */
function buildMe(overrides: Partial<Profile> = {}): Profile {
  return buildProfile({
    id: 'me',
    name: 'Yo',
    location: 'Barcelona',
    timezone: 'Europe/Madrid',
    specialties: ['dev'],
    availability: { hoursPerWeek: 12, bands: ['noche'] },
    ambition: 'equilibrado',
    prompts: [],
    ...overrides,
  });
}

/** El perfil del otro lado. Por defecto no aporta prompt ni especialidades. */
function buildThem(overrides: Partial<Profile> = {}): Profile {
  return buildProfile({
    id: 'them',
    name: 'Ellos',
    location: 'Bogotá',
    timezone: 'America/Bogota',
    specialties: [],
    availability: { hoursPerWeek: 8, bands: ['manana'] },
    ambition: 'lifestyle',
    prompts: [],
    ...overrides,
  });
}

describe('suggestIcebreakers — forma del resultado', () => {
  it('nunca devuelve más de tres sugerencias', () => {
    const them = buildThem({
      specialties: ['diseno', 'producto'],
      availability: { hoursPerWeek: 10, bands: ['noche'] },
      ambition: 'equilibrado',
      prompts: [{ question: '¿Qué quieres construir?', answer: 'Un CRM.' }],
    });

    expect(suggestIcebreakers(them, buildMe(), 'par')).toHaveLength(3);
  });

  it('no repite ninguna sugerencia', () => {
    const suggestions = suggestIcebreakers(
      buildThem({ specialties: ['diseno'], prompts: [{ question: 'q', answer: 'a' }] }),
      buildMe(),
      'par'
    );

    expect(new Set(suggestions).size).toBe(suggestions.length);
  });

  it('sin perfil propio solo aplica las reglas que miran al otro', () => {
    const them = buildThem({
      // Coincide con el perfil propio de referencia en todo lo que dispararía
      // una regla de pareja: si alguna se colara, se vería aquí.
      specialties: ['dev'],
      availability: { hoursPerWeek: 12, bands: ['noche'] },
      ambition: 'equilibrado',
      startingPoint: 'algo-empezado',
      prompts: [{ question: '¿Qué quieres construir?', answer: 'Un CRM.' }],
    });

    expect(suggestIcebreakers(them, null, 'par')).toEqual([
      'Has puesto «Un CRM.». Cuéntame más.',
      'Veo que llevas desarrollo. ¿Cómo llegaste ahí?',
      'Dices que ya tocaste algo. ¿Qué tienes montado y qué te falta?',
    ]);
  });

  it('las reglas de pareja van antes que las que solo miran al otro', () => {
    const them = buildThem({
      specialties: ['diseno'],
      availability: { hoursPerWeek: 10, bands: ['noche'] },
      // Mismo huso: así solo saltan dos reglas de pareja y se ve que la tercera
      // plaza se la lleva la primera regla individual, no al revés.
      timezone: 'Europe/Madrid',
      prompts: [{ question: '¿Qué quieres construir?', answer: 'Un CRM.' }],
    });

    expect(suggestIcebreakers(them, buildMe(), 'par')).toEqual([
      'Yo voy más por desarrollo y tú por diseño — eso encaja. ¿Qué parte te apetecería llevar?',
      'Los dos solemos estar por la noche. ¿Probamos un Lock-In esta semana a esa hora?',
      'Has puesto «Un CRM.». Cuéntame más.',
    ]);
  });
});

describe('especialidades complementarias', () => {
  it('nombra lo de cada uno cuando ninguno cubre lo del otro', () => {
    const them = buildThem({ specialties: ['diseno', 'producto'] });

    expect(suggestIcebreakers(them, buildMe({ specialties: ['dev'] }), 'par')[0]).toBe(
      'Yo voy más por desarrollo y tú por diseño y producto — eso encaja. ¿Qué parte te apetecería llevar?'
    );
  });

  it('calla si lo mío es un subconjunto de lo suyo', () => {
    const them = buildThem({ specialties: ['dev', 'diseno'] });
    const suggestions = suggestIcebreakers(them, buildMe({ specialties: ['dev'] }), 'par');

    expect(suggestions.some((line) => line.startsWith('Yo voy más por'))).toBe(false);
  });

  it('calla si lo suyo es un subconjunto de lo mío', () => {
    const them = buildThem({ specialties: ['dev'] });
    const suggestions = suggestIcebreakers(
      them,
      buildMe({ specialties: ['dev', 'marketing'] }),
      'par'
    );

    expect(suggestions.some((line) => line.startsWith('Yo voy más por'))).toBe(false);
  });

  it('convive con el solapamiento: primero lo que falta, luego lo común', () => {
    const them = buildThem({ specialties: ['dev', 'diseno'] });
    const suggestions = suggestIcebreakers(
      them,
      buildMe({ specialties: ['dev', 'marketing'] }),
      'par'
    );

    expect(suggestions.slice(0, 2)).toEqual([
      'Yo voy más por marketing y tú por diseño — eso encaja. ¿Qué parte te apetecería llevar?',
      'Los dos venimos de desarrollo. ¿En qué parte te sientes más fuerte?',
    ]);
  });
});

describe('especialidades compartidas', () => {
  it('enumera todas las que coinciden', () => {
    const them = buildThem({ specialties: ['dev', 'datos'] });
    const me = buildMe({ specialties: ['dev', 'datos'] });

    expect(suggestIcebreakers(them, me, 'par')[0]).toBe(
      'Los dos venimos de desarrollo y datos. ¿En qué parte te sientes más fuerte?'
    );
  });

  it('calla si no hay ninguna en común', () => {
    const them = buildThem({ specialties: ['diseno'] });
    const suggestions = suggestIcebreakers(them, buildMe({ specialties: [] }), 'par');

    expect(suggestions.some((line) => line.startsWith('Los dos venimos de'))).toBe(false);
  });
});

describe('franja horaria compartida', () => {
  /** Sin especialidades propias no disparan las dos reglas anteriores. */
  const me = buildMe({ specialties: [] });

  it('propone el Lock-In sobre la franja que comparten', () => {
    const them = buildThem({ availability: { hoursPerWeek: 10, bands: ['noche'] } });

    expect(suggestIcebreakers(them, me, 'par')[0]).toBe(
      'Los dos solemos estar por la noche. ¿Probamos un Lock-In esta semana a esa hora?'
    );
  });

  it('con varias franjas comunes usa la primera del otro perfil', () => {
    const them = buildThem({ availability: { hoursPerWeek: 10, bands: ['tarde', 'noche'] } });
    const flexibleMe = buildMe({
      specialties: [],
      availability: { hoursPerWeek: 12, bands: ['noche', 'tarde'] },
    });

    expect(suggestIcebreakers(them, flexibleMe, 'par')[0]).toBe(
      'Los dos solemos estar por la tarde. ¿Probamos un Lock-In esta semana a esa hora?'
    );
  });

  it('calla si no coinciden en ninguna franja', () => {
    const them = buildThem({ availability: { hoursPerWeek: 10, bands: ['madrugada'] } });
    const suggestions = suggestIcebreakers(them, me, 'par');

    expect(suggestions.some((line) => line.startsWith('Los dos solemos estar'))).toBe(false);
  });
});

describe('ambición compartida', () => {
  /** Sin especialidades ni franja común, la ambición es la primera regla que puede saltar. */
  const me = buildMe({ specialties: [] });

  it.each([
    [
      'todo-o-nada',
      'Los dos hemos puesto apostarlo todo. ¿Qué significa eso para ti en los próximos seis meses?',
    ],
    [
      'lifestyle',
      'Los dos buscamos algo sostenible más que un cohete. ¿Cómo sería para ti el tamaño ideal?',
    ],
    [
      'equilibrado',
      'Los dos queremos algo serio sin quemarnos. ¿Cuántas horas de verdad puedes sostener al mes?',
    ],
  ] as const)('con ambición %s pregunta lo suyo', (ambition, expected) => {
    const them = buildThem({ ambition });

    expect(suggestIcebreakers(them, buildMe({ specialties: [], ambition }), 'par')[0]).toBe(
      expected
    );
  });

  it('calla si las ambiciones no coinciden', () => {
    const them = buildThem({ ambition: 'todo-o-nada' });
    const suggestions = suggestIcebreakers(them, me, 'par');

    expect(suggestions.some((line) => line.startsWith('Los dos hemos puesto'))).toBe(false);
  });
});

describe('husos horarios distintos', () => {
  /** Todo lo anterior anulado: sin especialidades, sin franja común, sin ambición común. */
  const me = buildMe({ specialties: [], ambition: 'equilibrado' });

  it('pregunta por la hora nombrando las dos ciudades', () => {
    const them = buildThem({ location: 'Bogotá', timezone: 'America/Bogota' });

    expect(suggestIcebreakers(them, me, 'par')[0]).toBe(
      'Tú estás en Bogotá y yo en Barcelona. ¿Qué hora te encaja para coincidir?'
    );
  });

  it('calla si están en el mismo huso, aunque la ciudad sea otra', () => {
    const them = buildThem({ location: 'Valencia', timezone: 'Europe/Madrid' });
    const suggestions = suggestIcebreakers(them, me, 'par');

    expect(suggestions.some((line) => line.startsWith('Tú estás en'))).toBe(false);
  });
});

describe('citar su prompt', () => {
  it('usa la primera respuesta con contenido y la recorta', () => {
    const them = buildThem({
      prompts: [
        { question: 'Vacía', answer: '   ' },
        { question: '¿Qué quieres construir?', answer: '  Un CRM para veterinarias.  ' },
      ],
    });

    expect(suggestIcebreakers(them, null, 'par')[0]).toBe(
      'Has puesto «Un CRM para veterinarias.». Cuéntame más.'
    );
  });

  it('calla si ninguna respuesta tiene contenido', () => {
    const them = buildThem({ prompts: [{ question: 'Vacía', answer: '  ' }] });
    const suggestions = suggestIcebreakers(them, null, 'par');

    expect(suggestions.some((line) => line.startsWith('Has puesto'))).toBe(false);
  });
});

describe('reglas de reserva', () => {
  it('sin prompt cita sus especialidades', () => {
    const them = buildThem({ specialties: ['dev', 'datos'] });

    expect(suggestIcebreakers(them, null, 'par')[0]).toBe(
      'Veo que llevas desarrollo y datos. ¿Cómo llegaste ahí?'
    );
  });

  it.each([
    [
      'solo-ganas',
      'Dices que aún no tienes idea, solo ganas. ¿Qué terreno te llama más para empezar a mirar?',
    ],
    ['idea-sin-empezar', 'Tienes una idea pero sin empezar. ¿Qué te ha frenado hasta ahora?'],
    ['algo-empezado', 'Dices que ya tocaste algo. ¿Qué tienes montado y qué te falta?'],
  ] as const)('sin prompt ni especialidades abre por el punto de partida %s', (point, expected) => {
    expect(suggestIcebreakers(buildThem({ startingPoint: point }), null, 'par')[0]).toBe(expected);
  });

  it('el último recurso depende del modo del match', () => {
    const them = buildThem();

    expect(suggestIcebreakers(them, null, 'par')[1]).toBe(
      '¿Qué es lo que más te apetece construir ahora mismo?'
    );
    expect(suggestIcebreakers(them, null, 'lockin')[1]).toBe(
      '¿Cuándo es tu mejor rato para concentrarte? Busco con quién coincidir.'
    );
  });

  it('con un perfil pelado quedan dos sugerencias, no tres huecos', () => {
    expect(suggestIcebreakers(buildThem(), null, 'par')).toHaveLength(2);
  });
});
