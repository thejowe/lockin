/**
 * Superficie pública del bloque `premium`.
 *
 * Quien lo necesite importa desde `@/features/premium`, nunca de los archivos
 * sueltos.
 */

export { openPaywall } from './open-paywall';
export { usePremium, type PremiumState } from './use-premium';
export { IncomingLikes } from './incoming-likes';
export { LikesRow } from './likes-row';
