/**
 * Estado de un tema del acuerdo visto desde el usuario actual (spec § 1).
 *
 * El ciego lo impone el servidor. Aquí solo se repite la regla por si acaso: un
 * `'hidden'` nunca se trata como respondido, y una clave que este catálogo no
 * conoce cuenta como no respondida en los dos lados.
 */

import { AGREEMENT_CATALOG, UNDECIDED, isKnownAnswer, topicByKey } from './topics';

import type { AgreementTopicView } from '@/data';

export type { AgreementTopicView };

export type TopicStatus = 'pendiente' | 'coincidis' | 'distinto' | 'por-hablar';

export function topicStatus(topicKey: string, view: AgreementTopicView | undefined): TopicStatus {
  const mine = view?.mine && isKnownAnswer(topicKey, view.mine.option) ? view.mine : null;
  if (!mine) return 'pendiente';
  const theirs = view?.theirs;
  if (!theirs || theirs === 'hidden' || !isKnownAnswer(topicKey, theirs.option)) {
    return 'pendiente';
  }
  if (mine.option === UNDECIDED || theirs.option === UNDECIDED) return 'por-hablar';
  return mine.option === theirs.option ? 'coincidis' : 'distinto';
}

/** Lo que pinta la tarjeta del chat. Solo cuenta temas de este catálogo. */
export function summarize(views: readonly AgreementTopicView[]): {
  compared: number;
  different: number;
  theirsAhead: number;
  total: number;
} {
  let compared = 0;
  let different = 0;
  let theirsAhead = 0;
  for (const view of views) {
    if (!topicByKey(view.topic)) continue;
    const status = topicStatus(view.topic, view);
    if (status !== 'pendiente') compared++;
    if (status === 'distinto') different++;
    const mineKnown = view.mine !== null && isKnownAnswer(view.topic, view.mine.option);
    if (view.theirs !== null && !mineKnown) theirsAhead++;
  }
  return { compared, different, theirsAhead, total: AGREEMENT_CATALOG.length };
}
