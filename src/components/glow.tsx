/**
 * Halo de luz: un degradado radial de un color a transparente.
 *
 * Es la versión local de la luz ambiental: detrás del avatar de una tarjeta, de
 * un temporizador, de un icono destacado. Decorativo y sin interacción.
 */

import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

export function Glow({
  color,
  opacity = 0.55,
  style,
}: {
  color: string;
  /** Intensidad en el centro (0–1). */
  opacity?: number;
  /** Posición y tamaño del halo (normalmente absoluto). */
  style?: StyleProp<ViewStyle>;
}) {
  // Un id por halo: dos degradados con el mismo id en una pantalla web se pisan.
  const id = `glow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.root, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="0.55" stopColor={color} stopOpacity={opacity * 0.35} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
  },
});
