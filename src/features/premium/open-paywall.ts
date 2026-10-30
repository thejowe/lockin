/**
 * Abre el paywall (`/premium`).
 *
 * La ruta `src/app/premium.tsx` monta el paywall (Tarea 9 del plan de Premium).
 */

import { router, type Href } from 'expo-router';

export function openPaywall(): void {
  // `Href` a mano: las rutas tipadas se regeneran con `expo start` y /premium es nueva.
  router.push('/premium' as Href);
}
