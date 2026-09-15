/** Qué pinta la tarjeta del chat según la sesión viva, la valorable y quién mira. */

import { cardView } from './card-state';

import type { LockInSession } from '@/data';

const MINUTE = 60_000;
const START = Date.parse('2026-09-14T18:00:00.000Z');

const session = (overrides: Partial<LockInSession> = {}): LockInSession => ({
  id: 's1',
  matchId: 'm1',
  proposedBy: 'me',
  startsAt: new Date(START).toISOString(),
  blocks: 1,
  status: 'propuesta',
  createdAt: new Date(START - 60 * MINUTE).toISOString(),
  respondedAt: null,
  ...overrides,
});

/** Una terminada hace dos horas, de las que `getRatable` devuelve. */
const ratable = (): LockInSession =>
  session({
    id: 's0',
    status: 'aceptada',
    startsAt: new Date(START - 2 * 60 * MINUTE).toISOString(),
    respondedAt: new Date(START - 3 * 60 * MINUTE).toISOString(),
  });

describe('cardView', () => {
  it('sin sesión, o con una que ya no está viva, ofrece agendar', () => {
    expect(cardView(null, null, 'me', START - MINUTE)).toEqual({ kind: 'agendar' });
    expect(cardView(session(), null, 'me', START)).toEqual({ kind: 'agendar' });
    expect(cardView(session({ status: 'cancelada' }), null, 'me', START - MINUTE).kind).toBe(
      'agendar'
    );
  });

  it('una propuesta propia espera; una ajena se responde', () => {
    expect(cardView(session(), null, 'me', START - MINUTE).kind).toBe('esperando');
    expect(cardView(session({ proposedBy: 'nuria' }), null, 'me', START - MINUTE).kind).toBe(
      'recibida'
    );
  });

  it('una aceptada se enseña como acordada hasta que abre la ventana, y entonces deja entrar', () => {
    const accepted = session({
      status: 'aceptada',
      respondedAt: new Date(START - 30 * MINUTE).toISOString(),
    });
    expect(cardView(accepted, null, 'me', START - 5 * MINUTE - 1).kind).toBe('aceptada');
    expect(cardView(accepted, null, 'me', START - 5 * MINUTE).kind).toBe('entrar');
    expect(cardView(accepted, null, 'me', START + 29 * MINUTE).kind).toBe('entrar');
  });

  it('sin nada vivo, una sesión valorable pide la valoración', () => {
    const ended = ratable();
    expect(cardView(null, ended, 'me', START)).toEqual({ kind: 'valorar', session: ended });
    // Una sesión que ya no está viva tampoco tapa la repesca.
    expect(cardView(session({ status: 'cancelada' }), ended, 'me', START - MINUTE).kind).toBe(
      'valorar'
    );
  });

  it('la sesión viva gana siempre a la valorable', () => {
    const ended = ratable();
    const accepted = session({
      status: 'aceptada',
      respondedAt: new Date(START - 30 * MINUTE).toISOString(),
    });
    expect(cardView(session(), ended, 'me', START - MINUTE).kind).toBe('esperando');
    expect(cardView(session({ proposedBy: 'nuria' }), ended, 'me', START - MINUTE).kind).toBe(
      'recibida'
    );
    expect(cardView(accepted, ended, 'me', START - 10 * MINUTE).kind).toBe('aceptada');
    expect(cardView(accepted, ended, 'me', START - MINUTE).kind).toBe('entrar');
  });
});
