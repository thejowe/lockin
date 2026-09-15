/** Cuál de los tres finales pide la pantalla cuando la sesión acaba. */

import { endingView, RATING_OPTIONS, ratingLabel } from './rating';

import type { SessionAttendance, SessionTiming } from '@/data';

const MINUTE = 60_000;
const START = Date.parse('2026-09-14T18:00:00.000Z');

/** Una sesión de un bloque: acaba en START + 30 min. */
const session: SessionTiming = {
  status: 'aceptada',
  startsAt: new Date(START).toISOString(),
  blocks: 1,
};

const row = (profileId: string, offsetMs = MINUTE): SessionAttendance => ({
  sessionId: 's1',
  profileId,
  joinedAt: new Date(START + offsetMs).toISOString(),
  leftAt: null,
});

const BOTH = [row('me'), row('nuria')];

describe('endingView', () => {
  it('con los dos dentro y sin valorar, pregunta', () => {
    expect(endingView(BOTH, 'me', 'nuria', session, null)).toEqual({ kind: 'preguntar' });
  });

  it('si falta cualquiera de los dos no pregunta nada', () => {
    expect(endingView([row('me')], 'me', 'nuria', session, null)).toEqual({ kind: 'no-vino' });
    expect(endingView([row('nuria')], 'me', 'nuria', session, null)).toEqual({ kind: 'no-vino' });
    expect(endingView([], 'me', 'nuria', session, null)).toEqual({ kind: 'no-vino' });
  });

  it('ya valorada, agradece con cualquier asistencia', () => {
    for (const rows of [BOTH, [row('me')], [row('nuria')], []]) {
      expect(endingView(rows, 'me', 'nuria', session, 'genial')).toEqual({ kind: 'gracias' });
    }
  });

  it('una fila con leftAt sigue contando como haber entrado', () => {
    const left = [
      row('me'),
      { ...row('nuria'), leftAt: new Date(START + 2 * MINUTE).toISOString() },
    ];
    expect(endingView(left, 'me', 'nuria', session, null)).toEqual({ kind: 'preguntar' });
  });

  it('una fila posterior al final de la sesión no cuenta', () => {
    expect(
      endingView([row('me'), row('nuria', 30 * MINUTE)], 'me', 'nuria', session, null)
    ).toEqual({ kind: 'no-vino' });
  });

  it('mientras no se sepa quién es quién, no pregunta', () => {
    expect(endingView(BOTH, null, 'nuria', session, null)).toEqual({ kind: 'no-vino' });
    expect(endingView(BOTH, 'me', null, session, null)).toEqual({ kind: 'no-vino' });
  });
});

describe('las tres opciones', () => {
  it('van de peor a mejor, con etiqueta propia', () => {
    expect(RATING_OPTIONS).toEqual(['floja', 'bien', 'genial']);
    expect(RATING_OPTIONS.map(ratingLabel)).toEqual(['Floja', 'Bien', 'Genial']);
  });
});
