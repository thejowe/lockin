import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

import { isRoomLive, useQuery, useRefreshQuery, useRepositories, type RoomView } from '@/data';
import { useNow } from '@/features/session/use-now';

const LIVE_ROOMS_KEY = 'rooms:live';

/** Relee por cambios y al volver; el reloj retira salas sin esperar un evento. */
export function useLiveRooms(): {
  rooms: RoomView[];
  loading: boolean;
  error: Error | null;
  refresh(): void;
} {
  const repositories = useRepositories();
  const { data, loading, error, refresh } = useQuery(LIVE_ROOMS_KEY, () =>
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

/** Relee las salas de quien las pinte, sin suscribirse otra vez a sus cambios. */
export function useRefreshLiveRooms(): () => void {
  return useRefreshQuery(LIVE_ROOMS_KEY);
}
