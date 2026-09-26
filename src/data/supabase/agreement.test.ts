import { AgreementForbiddenError, AgreementInvalidError, AgreementModeError } from '../agreement';
import { createSupabaseAgreementRepository, toAgreementError, toAgreementViews } from './agreement';

import type { MatchAgreementRow } from './database.types';

const base: MatchAgreementRow = {
  topic: 'dedicacion',
  mine_option: null,
  mine_note: null,
  mine_updated_at: null,
  theirs_answered: false,
  theirs_option: null,
  theirs_note: null,
  theirs_updated_at: null,
};

describe('toAgreementViews', () => {
  it('sin respuesta del otro: theirs null', () => {
    const [view] = toAgreementViews([
      { ...base, mine_option: 'completa', mine_updated_at: '2026-09-24T10:00:00+00:00' },
    ]);
    expect(view).toEqual({
      topic: 'dedicacion',
      mine: {
        topic: 'dedicacion',
        option: 'completa',
        note: null,
        updatedAt: '2026-09-24T10:00:00.000Z',
      },
      theirs: null,
    });
  });

  it('respondida por el otro pero oculta: hidden', () => {
    const [view] = toAgreementViews([{ ...base, theirs_answered: true }]);
    expect(view).toEqual({ topic: 'dedicacion', mine: null, theirs: 'hidden' });
  });

  it('las dos reveladas', () => {
    const [view] = toAgreementViews([
      {
        ...base,
        mine_option: '10-25h',
        mine_updated_at: '2026-09-24T10:00:00+00:00',
        theirs_answered: true,
        theirs_option: 'completa',
        theirs_note: 'Todo',
        theirs_updated_at: '2026-09-24T09:00:00+00:00',
      },
    ]);
    expect(view.theirs).toEqual({
      topic: 'dedicacion',
      option: 'completa',
      note: 'Todo',
      updatedAt: '2026-09-24T09:00:00.000Z',
    });
  });
});

describe('toAgreementError', () => {
  it('traduce LI004, LI005 y 23514; deja pasar lo demás', () => {
    expect(toAgreementError({ code: 'LI004', message: 'x' })).toBeInstanceOf(
      AgreementForbiddenError
    );
    expect(toAgreementError({ code: 'LI005', message: 'x' })).toBeInstanceOf(AgreementModeError);
    expect(toAgreementError({ code: '23514', message: 'x' })).toBeInstanceOf(AgreementInvalidError);
    const other = { code: '08006', message: 'red' };
    expect(toAgreementError(other)).toBe(other);
  });
});

describe('createSupabaseAgreementRepository', () => {
  function fakeClient(responses: Record<string, { data: unknown; error: unknown }>) {
    const rpc = jest.fn((name: string) => Promise.resolve(responses[name]));
    return { rpc, client: { rpc } as never };
  }

  it('answer normaliza la nota, llama a la RPC y relee la vista del tema', async () => {
    const { rpc, client } = fakeClient({
      answer_agreement_topic: { data: {}, error: null },
      match_agreement: {
        data: [{ ...base, mine_option: 'completa', mine_updated_at: '2026-09-24T10:00:00+00:00' }],
        error: null,
      },
    });
    const repo = createSupabaseAgreementRepository({
      getClient: () => client,
      getUserId: async () => 'ana',
    });

    const view = await repo.answer({
      matchId: 'm1',
      topic: 'dedicacion',
      option: 'completa',
      note: '  ',
    });

    expect(rpc).toHaveBeenCalledWith('answer_agreement_topic', {
      p_match_id: 'm1',
      p_topic: 'dedicacion',
      p_option: 'completa',
      p_note: null,
    });
    expect(view.mine?.option).toBe('completa');
  });

  it('valida antes de tocar la red', async () => {
    const { rpc, client } = fakeClient({});
    const repo = createSupabaseAgreementRepository({
      getClient: () => client,
      getUserId: async () => 'ana',
    });

    await expect(
      repo.answer({ matchId: 'm1', topic: 'Mal!', option: 'completa' })
    ).rejects.toBeInstanceOf(AgreementInvalidError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('get traduce el error de la RPC', async () => {
    const { client } = fakeClient({
      match_agreement: { data: null, error: { code: 'LI005', message: 'solo par' } },
    });
    const repo = createSupabaseAgreementRepository({
      getClient: () => client,
      getUserId: async () => 'ana',
    });

    await expect(repo.get('m1')).rejects.toBeInstanceOf(AgreementModeError);
  });
});
