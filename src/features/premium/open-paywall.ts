/**
 * Abre el paywall (`/premium`).
 *
 * Con `origin` (el diamante pulsado, en coordenadas de ventana) el paywall hace
 * su apertura: el diamante crece desde ahí hasta tapar la pantalla y su azul se
 * disuelve en los planes. Sin él, entra con un fundido.
 */

import { router, type Href } from 'expo-router';

export type PaywallOrigin = { x: number; y: number; size: number };

export function openPaywall(options?: { origin?: PaywallOrigin }): void {
  const origin = options?.origin;
  if (!origin) {
    // `Href` a mano: las rutas tipadas se regeneran con `expo start` y /premium es nueva.
    router.push('/premium' as Href);
    return;
  }
  router.push({
    pathname: '/premium',
    params: { ox: String(origin.x), oy: String(origin.y), os: String(origin.size) },
  } as Href);
}
