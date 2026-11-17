/**
 * Mensajes sin leer: el número del globo rojo de la pestaña Matches y de cada
 * chat de la lista.
 *
 * Se relee con todo lo que puede moverlo: un mensaje 1:1 nuevo (llega por
 * `matches.subscribe`), uno de cualquiera de tus grupos, marcar un chat como
 * leído en este dispositivo y volver a la app desde segundo plano (lo que llegó
 * mientras tanto, p. ej. por push, o lo que leíste en otro dispositivo).
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useQuery, useRepositories, type UnreadCounts } from '@/data';
import { useMyGroups } from '@/features/groups';

/** Clave de la consulta, compartida por todos los que pintan el contador. */
export const UNREAD_QUERY = 'unread:counts';

const EMPTY: UnreadCounts = { total: 0, byMatch: {}, byGroup: {} };

export function useUnreadCounts(): UnreadCounts {
  const repositories = useRepositories();
  const { data, refresh } = useQuery(UNREAD_QUERY, () => repositories.unread.counts());
  const { groups } = useMyGroups();

  useEffect(() => repositories.unread.subscribe(refresh), [repositories, refresh]);
  useEffect(() => repositories.matches.subscribe(refresh), [repositories, refresh]);
  useEffect(() => repositories.groups.subscribe(refresh), [repositories, refresh]);

  // Ids como cadena estable: re-suscribir solo si cambia el conjunto de grupos.
  const groupIds = groups.map((view) => view.group.id).join(',');
  useEffect(() => {
    if (groupIds === '') return;
    const unsubscribes = groupIds
      .split(',')
      .map((groupId) => repositories.groups.subscribeMessages(groupId, refresh));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [repositories, refresh, groupIds]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return data ?? EMPTY;
}

/**
 * Marca un chat como leído mientras está delante: al entrar, cada vez que
 * cambia `version` (llega un mensaje con la pantalla abierta) y al salir. Si
 * falla no pasa nada visible: el globo se quedará hasta la siguiente marca.
 */
export function useMarkChatRead(mark: () => Promise<void>, version: unknown): void {
  const focused = useRef(false);
  const markRef = useRef(mark);
  useEffect(() => {
    markRef.current = mark;
  }, [mark]);

  const markQuietly = useCallback(() => {
    markRef.current().catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      markQuietly();
      return () => {
        focused.current = false;
        markQuietly();
      };
    }, [markQuietly])
  );

  useEffect(() => {
    if (focused.current) markQuietly();
  }, [version, markQuietly]);
}
