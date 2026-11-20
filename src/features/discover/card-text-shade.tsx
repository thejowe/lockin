import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const FADE_HEIGHT = Spacing.four * 2;

/** El degradado sigue el borde del contenido, incluso si las pestañas o el texto crecen. */
export function CardTextShade({
  id,
  alpha,
  testID,
  edge = 'bottom',
}: {
  id: string;
  alpha: string;
  testID?: string;
  edge?: 'top' | 'bottom';
}) {
  const theme = useTheme();
  const opacity = parseInt(alpha, 16) / 255;
  return (
    <View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, edge === 'bottom' ? styles.below : styles.above]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient
            id={id}
            gradientUnits="userSpaceOnUse"
            x1={0}
            y1={0}
            x2={0}
            y2={FADE_HEIGHT}>
            <Stop offset="0" stopColor={theme.background} stopOpacity={0} />
            <Stop offset="0.25" stopColor={theme.background} stopOpacity={opacity * 0.15} />
            <Stop offset="0.75" stopColor={theme.background} stopOpacity={opacity * 0.85} />
            <Stop offset="1" stopColor={theme.background} stopOpacity={opacity} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // Un único rectángulo: el último stop se prolonga por toda la zona de texto.
  // Android redondeaba a píxeles dos superficies contiguas dejando una línea.
  below: { bottom: -FADE_HEIGHT, transform: [{ scaleY: -1 }] },
  above: { top: -FADE_HEIGHT },
});
