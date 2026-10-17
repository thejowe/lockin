/**
 * La mano que enseña a tocar la tarjeta, la primera vez que se abre Descubrir.
 *
 * Decisión del usuario del 2026-10-17: quien entra por primera vez no sabe que
 * un toque en la tarjeta pasa al siguiente bloque de información (qué busca,
 * horario, respuestas). Sobre la información de la primera tarjeta aparece una
 * mano que pulsa, con una onda en la yema y un «Toca para ver más».
 *
 * - No intercepta nada (`pointerEvents="none"`): el toque llega a la tarjeta,
 *   que pasa de bloque, y eso es lo que la retira (`useTapHint().dismiss`). Una
 *   decisión (Like/Pasar) también la retira: la pista no vuelve a salir.
 * - Se recuerda en `AsyncStorage`: es una comodidad de este teléfono. Si no se
 *   puede leer, no se enseña (mejor sin pista que repetirla en cada arranque).
 * - Con «reducir movimiento», la mano está quieta y sin onda.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Curves, Duration, Radii, Spacing, Stroke } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

export const TAP_HINT_KEY = 'cofounder.hint.card-tap.seen';

/** Mano con el índice extendido (Material «touch_app», Apache 2.0). */
const HAND =
  'M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z';

const HAND_SIZE = 64;
/** Un ciclo: baja, pulsa, sube y espera antes del siguiente. */
const PRESS_MS = 260;
const REST_MS = 900;

const easeOut = Easing.bezier(...Curves.out);

/** Si hay que enseñar la pista y cómo retirarla para siempre. */
export function useTapHint(): { visible: boolean; dismiss: () => void } {
  const [visible, setVisible] = useState(false);
  /** Ya retirada en este montaje: una lectura que llegue tarde no la resucita. */
  const dismissed = useRef(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(TAP_HINT_KEY).then(
      (seen) => {
        if (alive && seen === null && !dismissed.current) setVisible(true);
      },
      () => undefined
    );
    return () => {
      alive = false;
    };
  }, []);

  const dismiss = useCallback(() => {
    if (dismissed.current) return;
    // Aunque aún no se viera (la lectura no había llegado): quien ya toca o
    // decide no necesita la pista, ni ahora ni en el siguiente arranque.
    dismissed.current = true;
    setVisible(false);
    void AsyncStorage.setItem(TAP_HINT_KEY, '1').catch(() => undefined);
  }, []);

  return { visible, dismiss };
}

export function TapHint({
  bottom,
}: {
  /** Distancia al borde inferior de la tarjeta. */ bottom: number;
}) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const press = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    press.value = withRepeat(
      withSequence(
        withTiming(1, { duration: PRESS_MS, easing: easeOut }),
        withTiming(0, { duration: PRESS_MS, easing: easeOut }),
        withTiming(0, { duration: REST_MS })
      ),
      -1
    );
    return () => cancelAnimation(press);
  }, [reduceMotion, press]);

  const handStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: press.value * 6 }, { scale: 1 - press.value * 0.08 }],
  }));
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: press.value * 0.5,
    transform: [{ scale: 0.4 + press.value * 0.8 }],
  }));

  return (
    <Animated.View
      testID="tap-hint"
      pointerEvents="none"
      entering={FadeIn.duration(Duration.slow).delay(500)}
      exiting={FadeOut.duration(Duration.base)}
      style={[styles.root, { bottom }]}>
      <View style={styles.handBox}>
        <Animated.View
          style={[styles.ripple, { borderColor: theme.text }, rippleStyle]}
          accessible={false}
        />
        <Animated.View style={handStyle}>
          <Svg width={HAND_SIZE} height={HAND_SIZE} viewBox="0 0 24 24">
            <Path d={HAND} fill={theme.text} />
          </Svg>
        </Animated.View>
      </View>
      <View
        style={[
          styles.label,
          { backgroundColor: `${theme.background}B3`, borderColor: theme.border },
        ]}>
        <ThemedText type="smallBold">Toca para ver más</ThemedText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: Spacing.two,
  },
  handBox: {
    width: HAND_SIZE,
    height: HAND_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    // La yema del índice queda arriba y algo a la izquierda en el dibujo.
    top: HAND_SIZE * 0.14,
    left: HAND_SIZE * 0.24,
    width: HAND_SIZE * 0.42,
    height: HAND_SIZE * 0.42,
    borderRadius: HAND_SIZE,
    borderWidth: 2,
  },
  label: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radii.pill,
    borderWidth: Stroke.hairline,
  },
});
