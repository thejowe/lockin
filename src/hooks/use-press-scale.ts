/**
 * Press state compartido: el control cede un 3 % bajo el dedo y vuelve con un
 * muelle al soltar.
 *
 * Es la respuesta física que falta en un `Pressable` que solo baja la opacidad:
 * la opacidad dice «te he oído», la escala dice «lo estás tocando». El muelle
 * hace que un toque rápido no se quede a medias — si el dedo se levanta antes de
 * llegar al 0.97, la vuelta arranca desde donde iba.
 *
 * Con «reducir movimiento» no escala: el control se queda quieto y la opacidad
 * de `Opacity.pressed` sigue dando el feedback.
 */

import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { PressScale, Springs } from '@/constants/theme';

import { useReduceMotion } from './use-reduce-motion';

export function usePressScale() {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return {
    /** Estilo animado para el contenedor del control. */
    style,
    onPressIn: () => {
      if (!reduceMotion) scale.set(withSpring(PressScale, Springs.press));
    },
    onPressOut: () => {
      scale.set(reduceMotion ? 1 : withSpring(1, Springs.press));
    },
  };
}
