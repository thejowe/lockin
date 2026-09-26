/**
 * Acuerdo de socios contra Supabase.
 *
 * Todo pasa por RPC (`supabase/migrations/20260924000200_agreement_answers.sql`):
 * el ciego lo impone `match_agreement()`, y aquí solo se traduce. Las
 * dependencias se inyectan por lo mismo que en `sessions.ts`: la suite de
 * contrato necesita el mismo repositorio actuando como otra persona.
 */

import {
  AgreementForbiddenError,
  AgreementInvalidError,
  AgreementModeError,
  normalizeNote,
  validateAnswerInput,
} from '../agreement';
import { ensureUserId } from './auth';
import { getSupabaseClient } from './client';

import type { LockInSupabaseClient } from './client';
import type { MatchAgreementRow } from './database.types';
import type { AgreementRepository } from '../repositories';
import type { AgreementAnswer, AgreementTopicView } from '../types';

/** PostgREST serializa `timestamptz` como `…+00:00`; el dominio usa ISO con `Z`. */
const toIso = (value: string) => new Date(value).toISOString();

const answerOf = (
  topic: string,
  option: string | null,
  note: string | null,
  updatedAt: string | null
): AgreementAnswer | null =>
  option === null || updatedAt === null
    ? null
    : { topic, option, note, updatedAt: toIso(updatedAt) };

export function toAgreementViews(rows: MatchAgreementRow[]): AgreementTopicView[] {
  return rows.map((row) => ({
    topic: row.topic,
    mine: answerOf(row.topic, row.mine_option, row.mine_note, row.mine_updated_at),
    theirs: !row.theirs_answered
      ? null
      : (answerOf(row.topic, row.theirs_option, row.theirs_note, row.theirs_updated_at) ??
        'hidden'),
  }));
}

const DOMAIN_ERRORS: Record<string, new (message: string) => Error> = {
  LI004: AgreementForbiddenError,
  LI005: AgreementModeError,
  '23514': AgreementInvalidError,
};

/** `errcode` de las RPC del acuerdo → error de dominio. Cualquier otro sale intacto. */
export function toAgreementError(error: { code?: string; message: string }): unknown {
  const DomainError = error.code ? DOMAIN_ERRORS[error.code] : undefined;
  return DomainError ? new DomainError(error.message) : error;
}

export interface AgreementRepositoryDeps {
  getClient(): LockInSupabaseClient;
  /** Abre sesión si hace falta y devuelve el id del usuario. */
  getUserId(): Promise<string>;
}

const defaultDeps: AgreementRepositoryDeps = {
  getClient: getSupabaseClient,
  getUserId: ensureUserId,
};

export function createSupabaseAgreementRepository(
  deps: AgreementRepositoryDeps = defaultDeps
): AgreementRepository {
  async function get(matchId: string): Promise<AgreementTopicView[]> {
    await deps.getUserId();
    const { data, error } = await deps.getClient().rpc('match_agreement', { p_match_id: matchId });
    if (error) throw toAgreementError(error);
    return toAgreementViews((data ?? []) as MatchAgreementRow[]);
  }

  return {
    get,

    async answer(input) {
      validateAnswerInput(input);
      await deps.getUserId();
      const { error } = await deps.getClient().rpc('answer_agreement_topic', {
        p_match_id: input.matchId,
        p_topic: input.topic,
        p_option: input.option,
        p_note: normalizeNote(input.note),
      });
      if (error) throw toAgreementError(error);
      // Se relee la vista: la fila escrita no dice nada de la respuesta del otro.
      const view = (await get(input.matchId)).find((candidate) => candidate.topic === input.topic);
      if (!view) throw new Error('agreement: la respuesta recién escrita no aparece en la vista');
      return view;
    },
  };
}
