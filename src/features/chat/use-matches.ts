/**
 * Lista de matches del usuario, siempre al día.
 *
 * `useQuery` resuelve la primera carga; la suscripción del repositorio cubre lo
 * que pasa después (un match nuevo desde `descubrir`, un mensaje enviado desde
 * la conversación). Sin ella la lista se quedaría con el último mensaje viejo al
 * volver atrás desde un chat.
 */

import { useEffect } from 'react';

import { useQuery, useRepositories, type MatchWithProfile, type QueryState } from '@/data';

export function useMatches(): QueryState<MatchWithProfile[]> {
  const repositories = useRepositories();
  const query = useQuery('matches', () => repositories.matches.list());
  const { refresh } = query;

  useEffect(() => repositories.matches.subscribe(refresh), [repositories, refresh]);

  return query;
}
