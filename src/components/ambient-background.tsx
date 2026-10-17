/**
 * Lienzo de pantalla.
 *
 * Hasta el 2026-10-17 aquí había una luz ambiental difusa (una imagen
 * pre-desenfocada a pantalla completa, en tres tintes) detrás del cristal.
 * Decisión del usuario de ese día: fuera el difuminado de color, el fondo es
 * negro liso (`theme.background`). `AmbientBackground` y la prop `ambient` de
 * `Screen` se conservan para no tocar las pantallas que los usan, pero ya no
 * pintan nada; si vuelve una luz, vuelve aquí y solo aquí.
 */

import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** Los tintes que hubo. Hoy no cambian nada: se aceptan por compatibilidad. */
export type AmbientVariant = 'ember' | 'teal' | 'plum';

/** Antes, la luz ambiental. Hoy no pinta nada: el fondo es negro liso. */
export function AmbientBackground(_props: { variant?: AmbientVariant }) {
  return null;
}

/**
 * Raíz de pantalla: fondo negro. Sustituye al `View` con
 * `backgroundColor: theme.background` que abría cada pantalla.
 */
export function Screen({
  ambient: _ambient,
  style,
  children,
  ...rest
}: ViewProps & { ambient?: AmbientVariant }) {
  const theme = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.background }, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
