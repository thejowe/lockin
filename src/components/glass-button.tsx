/**
 * Botón de cristal translúcido, en dos tintes: claro y oscuro.
 *
 * Es el de la bienvenida («Iniciar sesión» en claro, «Registrarse» en oscuro):
 * dos píldoras de vidrio sobre la luz ambiental, donde la que es blanca se lee
 * como tal y la negra deja ver el fondo a través. Por eso no son `Button`: aquel
 * es una acción sólida (brasa) o un cristal neutro, y aquí lo que cuenta es el
 * tinte del vidrio.
 *
 * - iOS 26+: Liquid Glass del sistema (`GlassView`) con el tinte encima.
 * - Resto: `BlurView` debajo de un relleno tintado con alfa, canto fino y el
 *   brillo de 1 px arriba, como `Frosted` (ver `glass.tsx`). En Android sin
 *   `BlurTargetView` el desenfoque es un velo; el relleno ya garantiza que el
 *   texto se lea.
 *
 * Los tintes son literales a propósito, igual que `FROST_FILL`: son el color
 * del vidrio, no tinta de la paleta.
 */

import { BlurView } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { hasNativeGlass } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { BlurIntensity, Control, Opacity, Radii, Spacing, Stroke } from '@/constants/theme';
import { usePressScale } from '@/hooks/use-press-scale';
import { useTheme } from '@/hooks/use-theme';

export type GlassTint = 'light' | 'dark';

const TINT = {
  light: {
    /** Blanco lechoso: se ve blanco, pero el fondo aún asoma. */
    fill: '#F5F5F7D9',
    native: '#F5F5F7B3',
    border: '#FFFFFF66',
    highlight: '#FFFFFFB3',
  },
  dark: {
    /** Grafito casi negro, con más alfa que el esmerilado de la barra. */
    fill: '#0A0A0B8C',
    native: '#0A0A0B80',
    border: '#FFFFFF2E',
    highlight: '#FFFFFF24',
  },
} as const;

export function GlassButton({
  label,
  tint,
  onPress,
  disabled = false,
  accessibilityHint,
  style,
}: {
  label: string;
  tint: GlassTint;
  onPress: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const press = usePressScale();
  const colors = TINT[tint];
  const ink = tint === 'light' ? theme.background : theme.text;

  const content = (
    <ThemedText type="bodyStrong" style={{ color: ink }}>
      {label}
    </ThemedText>
  );

  return (
    <Animated.View style={[press.style, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}>
        {({ pressed }) => {
          const opacity = disabled ? Opacity.disabled : pressed ? Opacity.pressed : 1;

          if (hasNativeGlass()) {
            return (
              <GlassView
                glassEffectStyle="regular"
                colorScheme={tint}
                tintColor={colors.native}
                isInteractive
                style={[styles.button, { opacity }]}>
                {content}
              </GlassView>
            );
          }

          return (
            <View
              collapsable={false}
              style={[
                styles.button,
                styles.frost,
                {
                  opacity,
                  borderColor: colors.border,
                  boxShadow: `inset 0px 1px 0px ${colors.highlight}, 0px 12px 32px rgba(0, 0, 0, 0.3)`,
                },
              ]}>
              <BlurView
                tint={tint}
                intensity={BlurIntensity.sheet}
                style={StyleSheet.absoluteFill}
              />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.fill }]} />
              {content}
            </View>
          );
        }}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: Control.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.pill,
  },
  frost: {
    overflow: 'hidden',
    borderWidth: Stroke.hairline,
  },
});
