import {
  AGREEMENT_CATALOG,
  UNDECIDED,
  isKnownAnswer,
  optionLabel,
  optionsOf,
  topicByKey,
} from './topics';

const KEY = /^[a-z0-9-]{1,40}$/;

describe('catálogo del acuerdo', () => {
  it('tiene ocho temas en el orden de la spec', () => {
    expect(AGREEMENT_CATALOG.map((topic) => topic.key)).toEqual([
      'dedicacion',
      'horizonte',
      'dinero-propio',
      'participacion',
      'consolidacion',
      'decisiones',
      'si-uno-se-va',
      'lo-creado',
    ]);
  });

  it('todas las claves cumplen el check de la base y no se repiten', () => {
    const topicKeys = AGREEMENT_CATALOG.map((topic) => topic.key);
    expect(new Set(topicKeys).size).toBe(topicKeys.length);
    for (const topic of AGREEMENT_CATALOG) {
      expect(topic.key).toMatch(KEY);
      const optionKeys = optionsOf(topic).map((option) => option.key);
      expect(new Set(optionKeys).size).toBe(optionKeys.length);
      for (const key of optionKeys) expect(key).toMatch(KEY);
    }
  });

  it('cada tema acepta «Aún no lo sé» como última opción', () => {
    for (const topic of AGREEMENT_CATALOG) {
      expect(optionsOf(topic).at(-1)).toEqual({ key: UNDECIDED, label: 'Aún no lo sé' });
      expect(isKnownAnswer(topic.key, UNDECIDED)).toBe(true);
    }
  });

  it('ninguna opción habla de contratar, sueldo ni jefe', () => {
    const text = AGREEMENT_CATALOG.flatMap((topic) => [
      topic.question,
      ...topic.options.map((option) => option.label),
    ]).join(' ');
    expect(text).not.toMatch(/contrat|sueldo|salario|jefe|empleado|trabaja para/i);
  });

  it('resuelve etiquetas y rechaza claves desconocidas', () => {
    expect(topicByKey('dedicacion')?.section).toBe('compromiso');
    expect(optionLabel('dedicacion', 'completa')).toBe('Jornada completa');
    expect(optionLabel('dedicacion', 'no-existe')).toBeUndefined();
    expect(isKnownAnswer('no-existe', 'completa')).toBe(false);
    expect(isKnownAnswer('dedicacion', 'partes-iguales')).toBe(false);
  });
});
