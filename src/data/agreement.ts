/**
 * Reglas del acuerdo de socios compartidas por los dos backends.
 *
 * `agreementViews` es el espejo en memoria de `match_agreement()`
 * (`supabase/migrations/20260924000200_agreement_answers.sql`): si cambia la
 * regla del ciego allí, cambia aquí, y al revés.
 *
 * Errores: la UI decide qué decir mirando la clase, nunca el mensaje. En
 * Supabase salen de los `errcode` LI004, LI005 y 23514.
 */

import type { AgreementAnswer, AgreementAnswerInput, AgreementTopicView } from './types';

export const AGREEMENT_NOTE_MAX = 280;
const KEY = /^[a-z0-9-]{1,40}$/;

/** Match ajeno o inexistente. LI004. */
export class AgreementForbiddenError extends Error {
  override name = 'AgreementForbiddenError';
}

/** El match no es de Modo Par. LI005. */
export class AgreementModeError extends Error {
  override name = 'AgreementModeError';
}

/** Clave con formato inválido o nota demasiado larga. 23514, o validación previa. */
export class AgreementInvalidError extends Error {
  override name = 'AgreementInvalidError';
}

export function normalizeNote(note?: string | null): string | null {
  const trimmed = note?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/** Lanza `AgreementInvalidError` antes de tocar la red. La base lo comprueba igual. */
export function validateAnswerInput(input: AgreementAnswerInput): void {
  if (!KEY.test(input.topic) || !KEY.test(input.option)) {
    throw new AgreementInvalidError('agreement: clave de tema u opción con formato inválido');
  }
  const note = normalizeNote(input.note);
  if (note !== null && note.length > AGREEMENT_NOTE_MAX) {
    throw new AgreementInvalidError(`agreement: la nota pasa de ${AGREEMENT_NOTE_MAX} caracteres`);
  }
}

/** Fila guardada: lo que en Postgres es `agreement_answers`. */
export interface StoredAgreementAnswer extends AgreementAnswer {
  matchId: string;
  profileId: string;
}

const strip = ({ topic, option, note, updatedAt }: StoredAgreementAnswer): AgreementAnswer => ({
  topic,
  option,
  note,
  updatedAt,
});

/** Filas de UN match → vista del actor, con el ciego aplicado. Ordenada por tema. */
export function agreementViews(
  rows: readonly StoredAgreementAnswer[],
  actorId: string
): AgreementTopicView[] {
  const topics = [...new Set(rows.map((row) => row.topic))].sort();
  return topics.map((topic) => {
    const mine = rows.find((row) => row.topic === topic && row.profileId === actorId) ?? null;
    const other = rows.find((row) => row.topic === topic && row.profileId !== actorId) ?? null;
    return {
      topic,
      mine: mine && strip(mine),
      theirs: other === null ? null : mine === null ? 'hidden' : strip(other),
    };
  });
}
