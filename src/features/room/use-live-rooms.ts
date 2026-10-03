import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

import { isRoomLive, useQuery, useRepositories, type RoomView } from '@/data';
import { useNow } from '@/features/session/use-now';

/** Relee por cambios y al volver; el reloj retira salas sin esperar un evento. */
export function useLiveRooms(): {
  rooms: RoomView[];
  loading: boolean;
  error: Error | null;
  refresh(): void;
} {
  const repositories = useRepositories();
  const { data, loading, error, refresh } = useQuery('rooms:live', () =>
    repositories.rooms.listLive()
  );
  const nowMs = useNow(30_000);
  const focusedOnce = useRef(false);

  useEffect(() => repositories.rooms.subscribe(refresh), [repositories, refresh]);

  useFocusEffect(
    useCallback(() => {
      // La primera lectura ya la hace useQuery al montar.
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      refresh();
    }, [refresh])
  );

  return {
    rooms: (data ?? []).filter(({ room }) => isRoomLive(room, nowMs)),
    loading,
    error,
    refresh,
  };
}
