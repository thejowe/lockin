/**
 * Luz ambiental y lienzo de pantalla de la dirección «cristal».
 *
 * El cristal necesita algo detrás que refractar. Aquí es una sola fuente de
 * luz, tenue, que entra por arriba: la ventana de una habitación a oscuras.
 * Una, no tres manchas de color: la luz difusa multicolor es la firma de la
 * interfaz de plantilla. Pre-desenfocada a propósito: un desenfoque en tiempo
 * real sobre algo que ya es difuso costaría GPU sin cambiar nada a la vista.
 *
 * Las imágenes salen de un script (ver `docs/plan/todo/visual.md`) y su punto
 * más claro es `AmbientPeak` en `theme.ts`: el test de contraste mide el cristal
 * también sobre él. Si regeneras las imágenes, actualiza ese color.
 */

import { Image, StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

const SOURCES = {
  /** Luz cálida arriba a la derecha: Descubrir y la bienvenida. */
  ember: require('@/assets/images/ambient-ember.jpg'),
  /** Luz fría arriba a la izquierda: Matches, chat. */
  teal: require('@/assets/images/ambient-teal.jpg'),
  /** Luz cálida y baja arriba al centro: Perfil y formularios. */
  plum: require('@/assets/images/ambient-plum.jpg'),
} as const;

export type AmbientVariant = keyof typeof SOURCES;

/** La luz ambiental, a pantalla completa, detrás de todo. Decorativa. */
export function AmbientBackground({ variant = 'ember' }: { variant?: AmbientVariant }) {
  return (
    <Image
      source={SOURCES[variant]}
      style={StyleSheet.absoluteFill}
      resizeMode="cover"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="ambient-background"
    />
  );
}

/**
 * Raíz de pantalla: fondo grafito con su luz ambiental. Sustituye al `View`
 * con `backgroundColor: theme.background` que abría cada pantalla.
 */
export function Screen({
  ambient = 'ember',
  style,
  children,
  ...rest
}: ViewProps & { ambient?: AmbientVariant }) {
  const theme = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.background }, style]} {...rest}>
      <AmbientBackground variant={ambient} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
