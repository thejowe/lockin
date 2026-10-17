/**
 * El símbolo de cofounder, con su entrada animada.
 *
 * Es el mismo dibujo que `assets/brand/cofounder-symbol.svg`: dos medias lunas
 * que miran hacia fuera y un punto en el hueco común. Se pinta en tres capas
 * superpuestas (cada una un `Svg` con el mismo `viewBox`) para poder mover cada
 * pieza con un `Animated.View` normal, sin animar propiedades de SVG.
 *
 * La entrada cuenta lo que es la marca: las dos mitades llegan desde los lados
 * y se encuentran, y entonces aparece el punto, con un solo rebote corto (el
 * muelle `pop`, el mismo que el match). Con «reducir movimiento» el logo está
 * quieto desde el primer fotograma.
 */

import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { Curves, Springs } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

/** Caja del símbolo en la rejilla de 64 unidades (ver el SVG de marca). */
const VIEW_BOX = '5 14 54 36';
const ASPECT = 54 / 36;

const LEFT = 'M32 15.88 A18 18 0 1 0 32 48.12 A18 18 0 0 1 32 15.88 Z';
const RIGHT = 'M32 15.88 A18 18 0 1 1 32 48.12 A18 18 0 0 0 32 15.88 Z';

/** Cuánto llegan desplazadas las mitades, en fracción del ancho. */
const TRAVEL = 0.22;
const HALVES_MS = 900;
const DOT_DELAY_MS = 620;

const easeOut = Easing.bezier(...Curves.out);

export function CofounderLogo({
  width,
  animated = true,
  color,
  style,
}: {
  /** Ancho en puntos; el alto sale de la proporción del símbolo. */
  width: number;
  /** `false` lo pinta quieto (p. ej. dentro de otra animación). */
  animated?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const still = !animated || reduceMotion;
  const fill = color ?? theme.text;
  const height = width / ASPECT;

  const halves = useSharedValue(still ? 1 : 0);
  const dot = useSharedValue(still ? 1 : 0);

  useEffect(() => {
    if (still) {
      halves.value = 1;
      dot.value = 1;
      return;
    }
    halves.value = withTiming(1, { duration: HALVES_MS, easing: easeOut });
    dot.value = withDelay(DOT_DELAY_MS, withSpring(1, Springs.pop));
  }, [still, halves, dot]);

  const leftStyle = useAnimatedStyle(() => ({
    opacity: halves.value,
    transform: [{ translateX: -(1 - halves.value) * width * TRAVEL }],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    opacity: halves.value,
    transform: [{ translateX: (1 - halves.value) * width * TRAVEL }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, dot.value * 1.5),
    transform: [{ scale: dot.value }],
  }));

  const layer = { width, height };

  return (
    <View
      style={[{ width, height }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="cofounder">
      <Animated.View style={[styles.layer, layer, leftStyle]}>
        <Svg width={width} height={height} viewBox={VIEW_BOX}>
          <Path d={LEFT} transform="translate(-1 0)" fill={fill} />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, layer, rightStyle]}>
        <Svg width={width} height={height} viewBox={VIEW_BOX}>
          <Path d={RIGHT} transform="translate(1 0)" fill={fill} />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, layer, dotStyle]}>
        <Svg width={width} height={height} viewBox={VIEW_BOX}>
          <Circle cx={32} cy={32} r={5} fill={fill} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
