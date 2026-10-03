/**
 * Superficies de cristal.
 *
 * - `glassStyle` / `Glass`: la superficie de toda la app (tarjetas, filas,
 *   campos). Vidrio translúcido con canto fino y un brillo de 1 px arriba, la
 *   luz que entra por el borde superior. Sin desenfoque en tiempo real: debajo
 *   solo hay luz ambiental, ya difusa (ver `ambient-background.tsx`).
 * - `Frosted`: cristal esmerilado de verdad, con `BlurView`, para lo que flota
 *   sobre contenido que se desplaza (barra de pestañas, cabeceras, hojas). En
 *   Android el desenfoque nativo necesita un `BlurTargetView` con el contenido
 *   a desenfocar; sin él, `BlurView` pinta un velo translúcido, y el relleno
 *   oscuro de debajo garantiza que el texto encima se lea igual.
 */

import { BlurView } from 'expo-blur';
import type { RefObject } from 'react';
import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { BlurIntensity, Radii, Stroke, type ThemePalette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Brillo del canto superior más, si flota, una sombra amplia y suave. */
function glassShadow(theme: ThemePalette, floating: boolean): string {
  const highlight = `inset 0px 1px 0px ${theme.glassHighlight}`;
  return floating ? `${highlight}, 0px 18px 40px rgba(0, 0, 0, 0.35)` : highlight;
}

/**
 * Estilo de una superficie de cristal, para quien ya tiene su propio contenedor
 * (un `Pressable`, un `Animated.View`).
 */
export function glassStyle(
  theme: ThemePalette,
  {
    elevated = false,
    floating = false,
    radius = Radii.card,
  }: { elevated?: boolean; floating?: boolean; radius?: number } = {}
): ViewStyle {
  return {
    backgroundColor: elevated ? theme.backgroundSelected : theme.backgroundElement,
    borderRadius: radius,
    borderWidth: Stroke.hairline,
    borderColor: theme.border,
    boxShadow: glassShadow(theme, floating),
  };
}

export function Glass({
  elevated,
  floating,
  radius,
  style,
  ...rest
}: ViewProps & { elevated?: boolean; floating?: boolean; radius?: number }) {
  const theme = useTheme();
  return <View style={[glassStyle(theme, { elevated, floating, radius }), style]} {...rest} />;
}

/** Relleno de seguridad bajo el esmerilado: grafito al 72 %. */
const FROST_FILL = '#141416B8';

export function Frosted({
  radius = Radii.pill,
  intensity = BlurIntensity.bar,
  blurTarget,
  floating = true,
  style,
  children,
  ...rest
}: ViewProps & {
  radius?: number;
  intensity?: number;
  /** Solo Android: el contenido que hay que desenfocar debajo. */
  blurTarget?: RefObject<View | null>;
  floating?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.frost,
        {
          borderRadius: radius,
          borderColor: theme.border,
          backgroundColor: FROST_FILL,
          boxShadow: glassShadow(theme, floating),
        },
        style,
      ]}
      {...rest}>
      <BlurView
        tint="dark"
        intensity={intensity}
        blurTarget={blurTarget}
        blurMethod={
          Platform.OS === 'android' && blurTarget ? 'dimezisBlurViewSdk31Plus' : undefined
        }
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frost: {
    overflow: 'hidden',
    borderWidth: Stroke.hairline,
  },
});
