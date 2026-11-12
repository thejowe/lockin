/**
 * El relevo entre la intro (`AppIntro`) y la bienvenida (`/mode`).
 *
 * La intro arma el logo en el centro y, si el arranque acaba en la bienvenida
 * (sin cuenta), lo encoge hasta el sitio exacto donde esa pantalla pinta el suyo.
 * Para eso necesita saber tres cosas que viven en pantallas distintas, y este
 * módulo es el cable entre ellas:
 *
 *   - `active`: la intro sigue en pantalla. La bienvenida esconde su logo y su
 *     texto mientras tanto y los muestra cuando la intro aterriza;
 *   - `destination`: a dónde acaba yendo el arranque (`index.tsx`). Sin esto la
 *     intro no sabría si esperar al logo de la bienvenida o fundirse y listo;
 *   - `target`: dónde está el logo de la bienvenida, en coordenadas de ventana.
 *     `settled` es `false` mientras la pantalla puede seguir deslizándose al
 *     entrar: volar a una posición a medias dejaría el logo desencajado.
 *
 * `active` nace en `false` y lo enciende `beginIntro()` al importar `app-intro`
 * (el `_layout` lo importa antes del primer render): así las pantallas que se
 * prueban sin intro se comportan como siempre.
 */

import { useSyncExternalStore } from 'react';

export type IntroDestination = 'unknown' | 'welcome' | 'app';
export interface LogoTarget {
  x: number;
  y: number;
  width: number;
  settled: boolean;
}

interface HandoffState {
  active: boolean;
  destination: IntroDestination;
  target: LogoTarget | null;
}

let state: HandoffState = { active: false, destination: 'unknown', target: null };
const listeners = new Set<() => void>();

function patch(next: Partial<HandoffState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export const introHandoff = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  begin: () => patch({ active: true, destination: 'unknown', target: null }),
  finish: () => patch({ active: false, target: null }),
  setDestination: (destination: IntroDestination) => {
    if (state.destination !== destination) patch({ destination });
  },
  setTarget: (target: LogoTarget) => patch({ target }),
};

/** `true` mientras la intro tapa la app. */
export function useIntroActive() {
  return useSyncExternalStore(introHandoff.subscribe, () => state.active);
}
