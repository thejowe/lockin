/**
 * La valoración de una sesión: la que ya escribiste y la que escribes ahora.
 *
 * Lee dos cosas —tu valoración y las filas de asistencia— porque el final de la
 * pantalla depende de las dos (`endingView`). Las filas **no** cuelgan de
 * `useAttendance`: ese hook es el efecto de entrar y salir, y esto es un dato
 * que se lee; mezclarlos le metería una consulta a quien solo quiere entrar.
 *
 * `attendance` es `null` mientras no se sabe: con `[]` la pantalla parpadearía
 * a "no entró" antes de llegar a preguntar.
 */

import { useCallback, useState } from 'react';

import {
  SessionConflictError,
  SessionForbiddenError,
  SessionWindowError,
  useQuery,
  useRepositories,
} from '@/data';

import { RATING_CLOSED, RATING_FAILED } from './rating';
import { useResolvedOrPrevious } from './use-resolved-or-previous';

import type { SessionAttendance, SessionRating } from '@/data';

export interface RatingState {
  /** Tu valoración, o `null` si todavía no has valorado. */
  rating: SessionRating | null;
  /** Quién entró a la sesión. `null` mientras se está leyendo. */
  attendance: SessionAttendance[] | null;
  submit(rating: SessionRating): Promise<void>;
  /** `RATING_CLOSED` (definitivo) o `RATING_FAILED` (se reintenta). */
  error: string | null;
  pending: boolean;
}

export function useRating(sessionId: string): RatingState {
  const repositories = useRepositories();

  const ratingQuery = useQuery(`session:rating:${sessionId}`, () =>
    repositories.sessions.getMyRating(sessionId)
  );
  const attendanceQuery = useQuery(`session:attendance:${sessionId}`, () =>
    repositories.sessions.listAttendance(sessionId)
  );
  const rating = useResolvedOrPrevious(ratingQuery.data, ratingQuery.loading);
  const attendance = useResolvedOrPrevious(attendanceQuery.data, attendanceQuery.loading);

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { refresh } = ratingQuery;

  const submit = useCallback(
    async (value: SessionRating) => {
      setPending(true);
      setError(null);
      try {
        await repositories.sessions.rate(sessionId, value);
      } catch (cause: unknown) {
        if (cause instanceof SessionWindowError || cause instanceof SessionForbiddenError) {
          // El servidor no lo va a aceptar por más veces que se toque.
          setError(RATING_CLOSED);
        } else if (!(cause instanceof SessionConflictError)) {
          setError(RATING_FAILED);
        }
        // El conflicto se traga en silencio: significa que ya hay una
        // valoración escrita, y la relectura de abajo la trae.
      } finally {
        setPending(false);
        refresh();
      }
    },
    [repositories, sessionId, refresh]
  );

  return { rating, attendance, submit, error, pending };
}
