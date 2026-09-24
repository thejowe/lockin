import {
  AGREEMENT_NOTE_MAX,
  AgreementInvalidError,
  agreementViews,
  normalizeNote,
  validateAnswerInput,
} from './agreement';

import type { StoredAgreementAnswer } from './agreement';

const row = (profileId: string, topic: string, option: string): StoredAgreementAnswer => ({
  matchId: 'm1',
  profileId,
  topic,
  option,
  note: null,
  updatedAt: '2026-09-24T10:00:00.000Z',
});

describe('normalizeNote', () => {
  it('recorta y convierte lo vacío en null', () => {
    expect(normalizeNote('  hola  ')).toBe('hola');
    expect(normalizeNote('   ')).toBeNull();
    expect(normalizeNote('')).toBeNull();
    expect(normalizeNote(null)).toBeNull();
    expect(normalizeNote(undefined)).toBeNull();
  });
});

describe('validateAnswerInput', () => {
  const ok = { matchId: 'm1', topic: 'dedicacion', option: 'completa' };

  it('acepta claves con formato y nota hasta el máximo', () => {
    expect(() =>
      validateAnswerInput({ ...ok, note: 'x'.repeat(AGREEMENT_NOTE_MAX) })
    ).not.toThrow();
  });

  it('rechaza claves con formato inválido', () => {
    expect(() => validateAnswerInput({ ...ok, topic: 'Dedicación!' })).toThrow(
      AgreementInvalidError
    );
    expect(() => validateAnswerInput({ ...ok, option: '' })).toThrow(AgreementInvalidError);
  });

  it('rechaza una nota de más de 280 caracteres, contada tras recortar', () => {
    expect(() => validateAnswerInput({ ...ok, note: 'x'.repeat(281) })).toThrow(
      AgreementInvalidError
    );
    expect(() =>
      validateAnswerInput({ ...ok, note: `  ${'x'.repeat(AGREEMENT_NOTE_MAX)}  ` })
    ).not.toThrow();
  });
});

describe('agreementViews: el ciego del mock, espejo de match_agreement()', () => {
  it('sin mi respuesta, la del otro sale hidden', () => {
    expect(agreementViews([row('bea', 'decisiones', 'consenso')], 'ana')).toEqual([
      { topic: 'decisiones', mine: null, theirs: 'hidden' },
    ]);
  });

  it('con las dos, se ven las dos; con solo la mía, theirs es null', () => {
    const views = agreementViews(
      [
        row('ana', 'dedicacion', '10-25h'),
        row('bea', 'dedicacion', 'completa'),
        row('ana', 'horizonte', '1-ano'),
      ],
      'ana'
    );
    expect(views.find((view) => view.topic === 'dedicacion')?.theirs).toMatchObject({
      option: 'completa',
    });
    expect(views.find((view) => view.topic === 'horizonte')?.theirs).toBeNull();
  });
});
