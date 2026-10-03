/**
 * Estados de pantalla completa: cargando, vacío, error, no disponible.
 *
 * Cada pantalla tenía el suyo: un `Centered` en Descubrir, otro en el chat, otro
 * en el acuerdo, un `Notice` en la sesión y un `Button` nativo en el arranque,
 * con huecos, tamaños y botones distintos (sólido en uno, enlace de texto en
 * otro). Aquí hay una sola forma:
 *
 * - **Cargando**: indicador en latón y una frase que dice qué se está buscando.
 *   Nunca una pantalla en blanco: en blanco no se distingue «tarda» de «roto».
 * - **Mensaje**: etiqueta opcional, titular, una línea
 *   de por qué, y las acciones debajo (botones de `Button`, la principal
 *   primero).
 *
 * Entra con un fundido corto: el estado suele sustituir a otro (carga → vacío)
 * y un corte seco se lee como parpadeo. Reanimated desactiva el fundido solo
 * con «reducir movimiento» (`ReduceMotion.System`, su valor por defecto).
 */

import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Duration, MaxContentWidth, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function LoadingState({
  label,
  detail,
  style,
}: {
  /** Qué se está cargando: «Buscando perfiles…», «Cargando la sesión…». */
  label: string;
  /** Una línea más de contexto, si la espera la necesita. */
  detail?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(Duration.base)}
      style={[styles.root, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}>
      <ActivityIndicator color={theme.brass} />
      <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
        {label}
      </ThemedText>
      {detail ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          {detail}
        </ThemedText>
      ) : null}
    </Animated.View>
  );
}

export function MessageState({
  eyebrow,
  eyebrowColor = 'brass',
  title,
  body,
  detail,
  children,
  style,
}: {
  /** Etiqueta corta en versales sobre el titular. */
  eyebrow?: string;
  eyebrowColor?: ThemeColor;
  title?: string;
  body?: string;
  /** Dato técnico en pequeño (p. ej. la causa de un error de arranque). */
  detail?: string;
  /** Acciones: `Button`, la principal primero. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View entering={FadeIn.duration(Duration.base)} style={[styles.root, style]}>
      <View style={styles.text}>
        {eyebrow ? (
          <ThemedText type="label" themeColor={eyebrowColor} style={styles.centered}>
            {eyebrow}
          </ThemedText>
        ) : null}
        {title ? (
          <ThemedText type="subtitle" style={styles.centered}>
            {title}
          </ThemedText>
        ) : null}
        {body ? (
          <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
            {body}
          </ThemedText>
        ) : null}
        {detail ? (
          <ThemedText type="caption" themeColor="textMuted" style={styles.centered}>
            {detail}
          </ThemedText>
        ) : null}
      </View>

      {children ? <View style={styles.actions}>{children}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    padding: Spacing.four,
  },
  text: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  centered: {
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
});
