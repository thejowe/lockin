/**
 * El relevo entre la intro (`AppIntro`) y la bienvenida (`/mode`).
 *
 * La intro arma el logo en el centro de un telón y lo abre para destapar la
 * página. Para no destapar una pantalla a medio montar necesita saber tres cosas
 * que viven en pantallas distintas, y este módulo es el cable entre ellas:
 *
 *   - `active`: el telón sigue cerrado. La bienvenida esconde su logo y su texto
 *     mientras tanto y los muestra en cuanto el telón empieza a abrirse;
 *   - `destination`: a dónde acaba yendo el arranque (`index.tsx`). Sin esto la
 *     intro no sabría si esperar a la bienvenida o abrir ya;
 *   - `target`: dónde está el logo de la bienvenida, en coordenadas de ventana.
 *     `settled` es `false` mientras la pantalla puede seguir deslizándose al
 *     entrar: la intro espera a que asiente antes de abrir.
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
