/**
 * Abre el paywall (`/premium`).
 *
 * `fromGem` lo usa la animación del diamante (`premium-cta.tsx`): el paywall
 * abre bajo su velo y retrasa la entrada de su contenido hasta que se retira.
 */

import { router, type Href } from 'expo-router';

export function openPaywall(options?: { fromGem?: boolean }): void {
  // `Href` a mano: las rutas tipadas se regeneran con `expo start` y /premium es nueva.
  router.push((options?.fromGem ? '/premium?via=gem' : '/premium') as Href);
}
