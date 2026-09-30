/**
 * Botón de acción de LockIn: píldora de alto `Control.button`.
 *
 * Antes vivía copiado en `descubrir` (`ActionButton`), en `perfil`
 * (`PrimaryButton`/`SecondaryButton`) y a mano en tres estados vacíos, cada uno
 * con su opacidad al pulsar. Ahora es uno: mismas medidas, mismo press state
 * (`usePressScale`) y la misma escala de `Opacity` en toda la app.
 *
 * - `primary`: latón sólido. Una por pantalla — es «lo siguiente que haces».
 * - `secondary`: contorno de trazo fino, tinta secundaria. Alternativa sin peso.
 * - `danger`: contorno de alerta. Descartar cambios, salir; nunca para juzgar a
 *   otra persona.
 *
 * Con `href` navega con `Link` (en web es un enlace de verdad). La forma del
 * botón va en una vista interna y no en el `style` del `Pressable`: `Link
 * asChild` en web descarta el estilo-función del hijo, y el botón se quedaba sin
 * fondo — texto blanco sobre el fondo claro, ilegible.
 */

import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Control, Opacity, Radii, Spacing, Stroke } from '@/constants/theme';
import { usePressScale } from '@/hooks/use-press-scale';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export function Button({
  label,
  onPress,
  href,
  variant = 'primary',
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress?: () => void;
  /** Destino, si el botón navega. Sustituye a `onPress`. */
  href?: Href;
  variant?: ButtonVariant;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Estilo del contenedor (p. ej. `flex: 1` en una fila de botones). */
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const press = usePressScale();
  const primary = variant === 'primary';

  const pressable = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}>
      {({ pressed }) => (
        <View
          style={[
            styles.button,
            primary
              ? { backgroundColor: theme.brass }
              : {
                  borderWidth: Stroke.hairline,
                  borderColor: variant === 'danger' ? theme.danger : theme.border,
                },
            disabled ? styles.disabled : pressed && styles.pressed,
          ]}>
          <ThemedText
            type="bodyStrong"
            themeColor={primary ? 'onAccent' : variant === 'danger' ? 'danger' : 'textSecondary'}>
            {label}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );

  return (
    <Animated.View style={[press.style, style]}>
      {href !== undefined ? (
        <Link href={href} asChild>
          {pressable}
        </Link>
      ) : (
        pressable
      )}
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
  pressed: {
    opacity: Opacity.pressed,
  },
  disabled: {
    opacity: Opacity.disabled,
  },
});
