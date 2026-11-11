/**
 * Los grupos del usuario, al día: se releen con cada aviso del repositorio
 * (alguien entra, sale o cambia el liderazgo). Desde el 2026-11-11 son hasta
 * `GROUP_MAX_MEMBERSHIPS`, y como mucho uno administrado (`adminGroup`).
 */

import { useEffect } from 'react';

import { useQuery, useRepositories, type GroupView } from '@/data';

/** Clave de la consulta: quien cambie un grupo desde otra pantalla la refresca. */
export const MY_GROUPS_QUERY = 'group:mine';

const EMPTY: GroupView[] = [];

export interface MyGroups {
  /** El que administra primero; después, en el orden en que entró. */
  groups: GroupView[];
  /** El grupo que administra, si lo hay. */
  adminGroup: GroupView | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useMyGroups(): MyGroups {
  const repositories = useRepositories();
  const { data, loading, error, refresh } = useQuery(MY_GROUPS_QUERY, () =>
    repositories.groups.listMine()
  );

  useEffect(() => repositories.groups.subscribe(refresh), [repositories, refresh]);

  const groups = data ?? EMPTY;
  return {
    groups,
    adminGroup: groups.find((view) => view.isAdmin) ?? null,
    loading,
    error,
    refresh,
  };
}
