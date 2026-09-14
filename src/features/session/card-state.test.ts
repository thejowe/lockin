/** Qué pinta la tarjeta del chat según la sesión viva y quién mira. */

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

describe('cardView', () => {
  it('sin sesión, o con una que ya no está viva, ofrece agendar', () => {
    expect(cardView(null, 'me', START - MINUTE)).toEqual({ kind: 'agendar' });
    expect(cardView(session(), 'me', START)).toEqual({ kind: 'agendar' });
    expect(cardView(session({ status: 'cancelada' }), 'me', START - MINUTE).kind).toBe('agendar');
  });

  it('una propuesta propia espera; una ajena se responde', () => {
    expect(cardView(session(), 'me', START - MINUTE).kind).toBe('esperando');
    expect(cardView(session({ proposedBy: 'nuria' }), 'me', START - MINUTE).kind).toBe('recibida');
  });

  it('una aceptada se enseña como acordada hasta que abre la ventana, y entonces deja entrar', () => {
    const accepted = session({
      status: 'aceptada',
      respondedAt: new Date(START - 30 * MINUTE).toISOString(),
    });
    expect(cardView(accepted, 'me', START - 5 * MINUTE - 1).kind).toBe('aceptada');
    expect(cardView(accepted, 'me', START - 5 * MINUTE).kind).toBe('entrar');
    expect(cardView(accepted, 'me', START + 29 * MINUTE).kind).toBe('entrar');
  });
});
