/**
 * Qué se pide al final de una sesión, y con qué palabras.
 *
 * Puro y sin React: las filas de asistencia y la valoración entran como
 * parámetros, igual que la hora en `card-state.ts`. El final tiene tres caras
 * (spec § 2) y la tercera no es un detalle: si la otra persona no entró **no se
 * pregunta nada**. Preguntar "¿qué tal ha ido?" a quien estuvo solo es sordo, y
 * convertir esa pregunta en el sitio donde se denuncia un plantón haría de la
 * valoración un castigo.
 */

import { attendedSession } from '@/data';

import type { SessionAttendance, SessionRating, SessionTiming } from '@/data';

export const RATING_OPTIONS: readonly SessionRating[] = ['floja', 'bien', 'genial'];

const LABELS: Record<SessionRating, string> = {
  floja: 'Floja',
  bien: 'Bien',
  genial: 'Genial',
};

export const ratingLabel = (rating: SessionRating) => LABELS[rating];

/** El servidor ya no la va a aceptar: se cerró la ventana o no te toca valorar. */
export const RATING_CLOSED = 'Ya no se puede valorar';
/** Falló el envío (sin red, por ejemplo). Se reintenta con otro toque. */
export const RATING_FAILED = 'No se ha podido guardar';

/** Cuál de los tres finales de la pantalla de sesión toca pintar. */
export type EndingView = { kind: 'preguntar' } | { kind: 'gracias' } | { kind: 'no-vino' };

/**
 * El final que toca, a partir de quién entró y de si ya valoraste.
 *
 * Sin `nowMs`: que la sesión haya terminado lo decide la pantalla con `phaseAt`,
 * y cruzar las 24 h con la pantalla abierta lo resuelve el error de `rate`
 * (spec § 3), no una comprobación previa.
 */
export function endingView(
  attendance: readonly SessionAttendance[],
  myProfileId: string | null,
  counterpartId: string | null,
  session: SessionTiming,
  rating: SessionRating | null
): EndingView {
  if (rating) return { kind: 'gracias' };
  const bothCame =
    myProfileId !== null &&
    counterpartId !== null &&
    attendedSession(attendance, myProfileId, session) &&
    attendedSession(attendance, counterpartId, session);
  return bothCame ? { kind: 'preguntar' } : { kind: 'no-vino' };
}
