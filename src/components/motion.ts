/**
 * Entradas compartidas de la dirección «cristal».
 *
 * Una sola forma de aparecer para toda la app: el contenido sube unos pocos
 * píxeles mientras se enciende, con la curva `out` (rápido y frena), y las
 * listas lo hacen en escalera, `Stagger` ms entre pieza y pieza. Nada rebota al
 * entrar: el rebote se reserva para lo que responde a la mano o celebra algo
 * (el match).
 *
 * Reanimated apaga estas entradas solo con «reducir movimiento»
 * (`ReduceMotion.System`, su valor por defecto): no hace falta ramificar aquí.
 */

import { Easing, FadeIn, FadeInUp } from 'react-native-reanimated';

import { Curves, Duration, Stagger } from '@/constants/theme';

const easeOut = Easing.bezier(...Curves.out);

/** El elemento `index` de una lista que entra en escalera. */
export function enterUp(index = 0) {
  return FadeInUp.duration(Duration.slow)
    .easing(easeOut)
    .delay(index * Stagger);
}

/** Un fundido corto, para lo que sustituye a otra cosa en el mismo sitio. */
export function enterFade(index = 0) {
  return FadeIn.duration(Duration.base).delay(index * Stagger);
}
