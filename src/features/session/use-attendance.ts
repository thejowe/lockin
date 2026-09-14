/**
 * Entrar y salir de la sesión en el servidor.
 *
 * Entra solo mientras `canJoin`, y reintenta cada 5 s si falla (sin red). Al
 * desmontar la pantalla antes del final registra la salida: cubre el gesto de
 * atrás del sistema sin depender de la API de navegación. Un `leave` que falla
 * se descarta: `leftAt` queda `null`, que la spec define como "no salió de forma
 * explícita".
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useRepositories } from '@/data';

const RETRY_MS = 5_000;

export interface Attendance {
  joined: boolean;
  leave(): Promise<void>;
}

export function useAttendance(sessionId: string, canJoin: boolean, ended: boolean): Attendance {
  const repositories = useRepositories();
  const [joined, setJoined] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const leftRef = useRef(false);
  const endedRef = useRef(ended);

  useEffect(() => {
    endedRef.current = ended;
  }, [ended]);

  useEffect(() => {
    if (!canJoin || joined || leftRef.current) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    repositories.sessions
      .join(sessionId)
      .then(() => {
        if (!cancelled) setJoined(true);
      })
      .catch(() => {
        if (!cancelled) retry = setTimeout(() => setAttempt((value) => value + 1), RETRY_MS);
      });

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, [repositories, sessionId, canJoin, joined, attempt]);

  useEffect(() => {
    if (!joined) return;
    return () => {
      if (!leftRef.current && !endedRef.current) {
        void repositories.sessions.leave(sessionId).catch(() => {});
      }
    };
  }, [repositories, sessionId, joined]);

  const leave = useCallback(async () => {
    leftRef.current = true;
    try {
      await repositories.sessions.leave(sessionId);
    } catch {
      // Descartado a propósito; ver la cabecera.
    }
  }, [repositories, sessionId]);

  return { joined, leave };
}
