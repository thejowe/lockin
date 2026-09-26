/**
 * El acuerdo de un match, con escritura y relectura.
 *
 * Sin realtime (spec § «Sin realtime»): se relee al volver a enfocar la
 * pantalla y después de cada respuesta. El primer foco coincide con el
 * montaje, donde `useQuery` ya lee, y se salta, como en `useMatchStreaks`.
 *
 * Una sola escritura en vuelo: el candado es un ref, no estado, para que dos
 * toques en el mismo tic no pasen los dos antes del re-render.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useQuery, useRepositories } from '@/data';

import type { AgreementTopicView } from '@/data';

export function useAgreement(matchId: string): {
  views: AgreementTopicView[];
  loading: boolean;
  error: Error | null;
  savingTopic: string | null;
  saveError: Error | null;
  answer(topic: string, option: string, note: string | null): Promise<boolean>;
  refresh(): void;
} {
  const repositories = useRepositories();
  const { data, loading, error, refresh } = useQuery(`agreement:${matchId}`, () =>
    repositories.agreement.get(matchId)
  );
  const [savingTopic, setSavingTopic] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<Error | null>(null);
  const inFlight = useRef(false);
  const focusedOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      refresh();
    }, [refresh])
  );

  const answer = useCallback(
    async (topic: string, option: string, note: string | null) => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setSavingTopic(topic);
      setSaveError(null);
      try {
        await repositories.agreement.answer({ matchId, topic, option, note });
        refresh();
        return true;
      } catch (caught) {
        setSaveError(caught instanceof Error ? caught : new Error(String(caught)));
        return false;
      } finally {
        inFlight.current = false;
        setSavingTopic(null);
      }
    },
    [repositories, matchId, refresh]
  );

  return { views: data ?? [], loading, error, savingTopic, saveError, answer, refresh };
}
