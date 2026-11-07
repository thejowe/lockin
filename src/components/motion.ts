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

import { usePageFocused } from '@/components/swipe-between-tabs';
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

/**
 * Las entradas de una pestaña: las de siempre si se monta en pantalla, ninguna
 * si se monta fuera.
 *
 * Las tres pestañas siguen montadas en el pager (`app-tabs.tsx`), así que una
 * ficha puede cargarse mientras se mira otra: pasa al cambiar de cuenta, con
 * `router.replace('/')`. En Android una entrada que arranca fuera de pantalla a
 * veces no termina nunca y deja la pieza en la opacidad 0 inicial — el E2E
 * `sign-in-abandon` encontró el Perfil vacío (2026-11-07). Una animación que
 * nadie ve tampoco aporta nada: sin ella, la pieza ya está cuando se llega.
 */
export function useTabEntering() {
  const focused = usePageFocused();
  return {
    up: (index = 0) => (focused ? enterUp(index) : undefined),
    fade: (index = 0) => (focused ? enterFade(index) : undefined),
  };
}
