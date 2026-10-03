/**
 * Punto de presencia: «está aquí».
 *
 * Mientras la otra persona está en la sesión, el punto verde-azulado respira:
 * un halo que se expande y se desvanece cada dos segundos, como la luz de una
 * cámara encendida. Es el único movimiento en bucle de la app, y solo dura lo
 * que dura la presencia. Ausente, el punto se queda gris y quieto. Con
 * «reducir movimiento», el halo no se anima.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Radii } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

const DOT = 8;
const BREATH_MS = 2000;

export function PresenceDot({ present }: { present: boolean }) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (present && !reduceMotion) {
      pulse.set(0);
      pulse.set(
        withRepeat(withTiming(1, { duration: BREATH_MS, easing: Easing.out(Easing.quad) }), -1)
      );
    } else {
      cancelAnimation(pulse);
      pulse.set(0);
    }
    return () => cancelAnimation(pulse);
  }, [present, reduceMotion, pulse]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.get()),
    transform: [{ scale: 1 + 1.6 * pulse.get() }],
  }));

  const color = present ? theme.teal : theme.textMuted;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.root}>
      {present ? <Animated.View style={[styles.dot, { backgroundColor: color }, halo]} /> : null}
      <View style={[styles.dot, styles.core, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: DOT,
    height: DOT,
  },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: Radii.pill,
  },
  core: {
    position: 'relative',
  },
});
