import { useEffect } from 'react';
import { useQuery, useRepositories } from '@/data';

export function useProjects(ownerId: string) {
  const { projects } = useRepositories();
  const query = useQuery('projects:' + ownerId, () => projects.list(ownerId));
  const { refresh } = query;
  useEffect(() => {
    const timer = setInterval(refresh, 45 * 60_000);
    return () => clearInterval(timer);
  }, [refresh]);
  return query;
}
