import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQuery, useRepositories } from '@/data';

/** `includePrivate` solo vale para el propio perfil: «Tus proyectos». */
export function useProjects(ownerId: string, includePrivate = false) {
  const { projects } = useRepositories();
  const query = useQuery('projects:' + ownerId + (includePrivate ? ':mine' : ''), () =>
    projects.list(ownerId, includePrivate ? { includePrivate } : undefined)
  );
  const { refresh } = query;
  useEffect(() => {
    // Public membership can change while a profile or deck card is mounted.
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refresh();
    }, 60_000);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [refresh]);
  return query;
}
