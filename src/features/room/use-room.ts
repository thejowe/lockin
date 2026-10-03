/**
 * Todo lo que necesita la pantalla de la sala: la sala vista desde el usuario,
 * el desfase con el reloj del servidor y las escrituras.
 *
 * Relee con cada aviso de `rooms.subscribe`, que llega también cuando alguien
 * deja de ser visible (rechaza tras aceptar) o la sala se cancela: el aviso es
 * por la sala, no por la fila (spec § 1, «Realtime»).
 *
 * `respond` y `cancel` son una sola escritura aunque se pidan dos veces seguidas
 * (doble toque): la segunda petición mientras vuela la primera no hace nada.
 * Un fallo llega a quien llama, que decide qué texto enseña, y la sala se relee
 * igualmente: un `SessionConflictError` al aceptar significa que la sala acaba
 * de cancelarse, y la relectura ya lo pinta.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useQuery, useRepositories, type RoomView } from '@/data';

export interface RoomState {
  view: RoomView | null;
  loading: boolean;
  error: Error | null;
  /** Milisegundos a sumar a `Date.now()` para tener la hora del servidor. */
  offsetMs: number;
  /** Hay una respuesta o una cancelación en vuelo. */
  pending: boolean;
  respond(answer: 'aceptada' | 'rechazada'): Promise<void>;
  cancel(): Promise<void>;
  join(): Promise<void>;
  leave(): Promise<void>;
  /** Vuelve a leer la sala (reintento tras un fallo de lectura). */
  refresh(): void;
}

export function useRoom(roomId: string): RoomState {
  const repositories = useRepositories();
  const query = useQuery(`room:${roomId}`, () => repositories.rooms.getById(roomId));
  const { refresh } = query;

  useEffect(() => repositories.rooms.subscribe(refresh), [repositories, refresh]);

  const [offsetMs, setOffsetMs] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const sentAt = Date.now();
    repositories.sessions
      .serverNow()
      .then((serverIso) => {
        if (cancelled) return;
        // La hora del servidor corresponde, como mejor estimación, al punto medio del viaje.
        const receivedAt = Date.now();
        setOffsetMs(Date.parse(serverIso) - (sentAt + receivedAt) / 2);
      })
      .catch(() => {
        // Sin hora del servidor se sigue con la del dispositivo.
      });
    return () => {
      cancelled = true;
    };
  }, [repositories]);

  const [pending, setPending] = useState(false);
  // El estado tarda un render en llegar al botón: el ref corta el segundo toque.
  const inFlight = useRef(false);

  const write = useCallback(
    async (run: () => Promise<unknown>) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setPending(true);
      try {
        await run();
      } finally {
        inFlight.current = false;
        setPending(false);
        refresh();
      }
    },
    [refresh]
  );

  const respond = useCallback(
    (answer: 'aceptada' | 'rechazada') => write(() => repositories.rooms.respond(roomId, answer)),
    [write, repositories, roomId]
  );
  const cancel = useCallback(
    () => write(() => repositories.rooms.cancel(roomId)),
    [write, repositories, roomId]
  );
  const join = useCallback(async () => {
    await repositories.rooms.join(roomId);
  }, [repositories, roomId]);
  const leave = useCallback(async () => {
    await repositories.rooms.leave(roomId);
  }, [repositories, roomId]);

  return {
    view: query.data,
    loading: query.loading,
    error: query.error,
    offsetMs,
    pending,
    respond,
    cancel,
    join,
    leave,
    refresh,
  };
}
