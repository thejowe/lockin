/**
 * Una acción de pantalla a la vez, entera: escritura y lo que venga detrás
 * (navegar, cambiar de estado).
 *
 * Dos toques llegan antes de que el botón se repinte deshabilitado, así que el
 * estado no basta: el ref corta el segundo en el acto. El segundo no espera al
 * primero ni repite nada; simplemente no ocurre.
 *
 * - `hold: true` para las acciones que se van de la pantalla (convocar, «No
 *   podré ir», salir): tras el éxito, todo sigue deshabilitado hasta desmontar.
 * - Si la tarea falla, se libera siempre y el error llega a quien llamó, para
 *   que se vea y se pueda reintentar.
 */

import { useCallback, useRef, useState } from 'react';

export interface SingleFlight {
  /** Hay una acción en curso (o una que se fue de la pantalla con `hold`). */
  busy: boolean;
  /** Lanza `task` si no hay otra en curso; si la hay, no hace nada. */
  run(task: () => Promise<void>, options?: { hold?: boolean }): Promise<void>;
}

export function useSingleFlight(): SingleFlight {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = useCallback(
    async (task: () => Promise<void>, { hold = false }: { hold?: boolean } = {}) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      const release = () => {
        busyRef.current = false;
        setBusy(false);
      };
      try {
        await task();
      } catch (error) {
        release();
        throw error;
      }
      if (!hold) release();
    },
    []
  );

  return { busy, run };
}
