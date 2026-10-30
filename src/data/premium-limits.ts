/**
 * Cupos de Premium. Los repite el SQL (`premium_limits()`); un test de la
 * Tarea 2 del plan compara ambos lados, así que cambiar uno exige cambiar el otro.
 *
 * Todas las ventanas son deslizantes y se cuentan con el reloj del servidor.
 */

/** Likes gratis cada 24 h. Con Premium no hay límite visible. */
export const FREE_LIKES_PER_DAY = 25;
/** Antiabuso: tope de likes cada 24 h para todo el mundo, también con Premium. */
export const ABUSE_LIKES_PER_DAY = 300;
/** Super Likes gratis cada 7 días. */
export const FREE_SUPERS_PER_WEEK = 1;
/** Super Likes con Premium cada 7 días. */
export const PREMIUM_SUPERS_PER_WEEK = 5;
/** Duración de un Boost. */
export const BOOST_MINUTES = 30;
/** Un Boost cada tantos días (desde que empezó el anterior). */
export const BOOST_COOLDOWN_DAYS = 30;
/** Solo se deshace un swipe más reciente que esto. */
export const UNDO_WINDOW_MINUTES = 10;
