/**
 * El grupo del usuario, al día: se relee con cada aviso del repositorio
 * (alguien entra, sale o cambia el liderazgo).
 */

import { useEffect } from 'react';

import { useQuery, useRepositories, type GroupView } from '@/data';

/** Clave de la consulta: quien cambie el grupo desde otra pantalla la refresca. */
export const MY_GROUP_QUERY = 'group:mine';

export interface MyGroup {
  group: GroupView | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useMyGroup(): MyGroup {
  const repositories = useRepositories();
  const { data, loading, error, refresh } = useQuery(MY_GROUP_QUERY, () =>
    repositories.groups.getMine()
  );

  useEffect(() => repositories.groups.subscribe(refresh), [repositories, refresh]);

  return { group: data, loading, error, refresh };
}
