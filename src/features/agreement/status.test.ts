import { summarize, topicStatus } from './status';

import type { AgreementTopicView } from './status';

const answer = (option: string) => ({
  topic: 'dedicacion',
  option,
  note: null,
  updatedAt: '2026-09-24T10:00:00.000Z',
});
const view = (
  mine: AgreementTopicView['mine'],
  theirs: AgreementTopicView['theirs']
): AgreementTopicView => ({ topic: 'dedicacion', mine, theirs });

describe('topicStatus', () => {
  it('sin vista ni respuesta propia: pendiente', () => {
    expect(topicStatus('dedicacion', undefined)).toBe('pendiente');
    expect(topicStatus('dedicacion', view(null, 'hidden'))).toBe('pendiente');
  });

  it('con la mía y sin la suya: pendiente', () => {
    expect(topicStatus('dedicacion', view(answer('completa'), null))).toBe('pendiente');
  });

  it('misma opción: coincidis', () => {
    expect(topicStatus('dedicacion', view(answer('completa'), answer('completa')))).toBe(
      'coincidis'
    );
  });

  it('opciones distintas: distinto', () => {
    expect(topicStatus('dedicacion', view(answer('completa'), answer('10-25h')))).toBe('distinto');
  });

  it('alguna es sin-decidir: por-hablar, aunque las dos lo sean', () => {
    expect(topicStatus('dedicacion', view(answer('sin-decidir'), answer('completa')))).toBe(
      'por-hablar'
    );
    expect(topicStatus('dedicacion', view(answer('sin-decidir'), answer('sin-decidir')))).toBe(
      'por-hablar'
    );
  });

  it('hidden con respuesta propia no revela nada: pendiente', () => {
    expect(topicStatus('dedicacion', view(answer('completa'), 'hidden'))).toBe('pendiente');
  });

  it('mi opción desconocida (catálogo viejo) cuenta como no respondida', () => {
    expect(topicStatus('dedicacion', view(answer('opcion-retirada'), answer('completa')))).toBe(
      'pendiente'
    );
  });

  it('la opción desconocida del otro tampoco se compara', () => {
    expect(topicStatus('dedicacion', view(answer('completa'), answer('opcion-retirada')))).toBe(
      'pendiente'
    );
  });
});

describe('summarize', () => {
  it('cuenta comparados, distintos y los que el otro lleva por delante', () => {
    const views: AgreementTopicView[] = [
      { topic: 'dedicacion', mine: answer('completa'), theirs: answer('completa') },
      {
        topic: 'horizonte',
        mine: { ...answer('1-ano'), topic: 'horizonte' },
        theirs: { ...answer('3-meses'), topic: 'horizonte' },
      },
      { topic: 'decisiones', mine: null, theirs: 'hidden' },
      { topic: 'tema-retirado', mine: null, theirs: 'hidden' },
    ];
    expect(summarize(views)).toEqual({ compared: 2, different: 1, theirsAhead: 1, total: 8 });
  });
});
