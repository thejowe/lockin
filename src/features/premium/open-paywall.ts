/**
 * Abre el paywall (`/premium`).
 *
 * STUB hasta la Tarea 9 del plan de Premium: la ruta `src/app/premium.tsx` es
 * por ahora un «muy pronto». Esta función no cambia cuando llegue el paywall
 * de verdad, solo la pantalla a la que navega.
 */

import { router, type Href } from 'expo-router';

export function openPaywall(): void {
  // `Href` a mano: las rutas tipadas se regeneran con `expo start` y /premium es nueva.
  router.push('/premium' as Href);
}
