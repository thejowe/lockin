/**
 * Acuerdo de socios del backend mock.
 *
 * Como `sessions.ts`, se construye para un actor: la suite de contrato necesita
 * a la otra persona del match respondiendo, con el mismo store.
 */

import {
  AgreementForbiddenError,
  AgreementModeError,
  agreementViews,
  normalizeNote,
  validateAnswerInput,
} from '../agreement';
import { SEED_AGREEMENT_ANSWERS } from './seed';
import { defaultMockStore } from './store';

import type { MockStore } from './store';
import type { AgreementRepository } from '../repositories';
import type { Match } from '../types';

export function createMockAgreementRepository(
  actorId: string,
  store: MockStore = defaultMockStore
): AgreementRepository {
  const nowIso = () => new Date(store.nowMs()).toISOString();

  const seedOnce = (match: Match) => {
    const state = store.state;
    if (state.agreementSeeded.has(match.id)) return;
    state.agreementSeeded.add(match.id);
    for (const profileId of match.profileIds) {
      for (const seed of SEED_AGREEMENT_ANSWERS[profileId] ?? []) {
        state.agreementAnswers.push({ ...seed, matchId: match.id, profileId, updatedAt: nowIso() });
      }
    }
  };

  /** Mismas puertas y en el mismo orden que las RPC: primero LI004, luego LI005. */
  const guard = (matchId: string) => {
    const match = store.state.matches.find((candidate) => candidate.id === matchId);
    if (!match || !match.profileIds.includes(actorId)) {
      throw new AgreementForbiddenError('agreement: el match no es tuyo');
    }
    if (match.mode !== 'par') {
      throw new AgreementModeError('agreement: el acuerdo es solo para matches de cofundador');
    }
    seedOnce(match);
  };

  const viewsOf = (matchId: string) =>
    agreementViews(
      store.state.agreementAnswers.filter((row) => row.matchId === matchId),
      actorId
    );

  return {
    async get(matchId) {
      guard(matchId);
      return viewsOf(matchId);
    },

    async answer(input) {
      validateAnswerInput(input);
      guard(input.matchId);
      const rows = store.state.agreementAnswers;
      const note = normalizeNote(input.note);
      const existing = rows.find(
        (row) =>
          row.matchId === input.matchId && row.profileId === actorId && row.topic === input.topic
      );
      if (existing) {
        existing.option = input.option;
        existing.note = note;
        existing.updatedAt = nowIso();
      } else {
        rows.push({
          matchId: input.matchId,
          profileId: actorId,
          topic: input.topic,
          option: input.option,
          note,
          updatedAt: nowIso(),
        });
      }
      return viewsOf(input.matchId).find((view) => view.topic === input.topic)!;
    },
  };
}
