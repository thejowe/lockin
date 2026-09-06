/**
 * Botón de acción del bloque `descubrir`.
 *
 * Repite la forma de los botones del onboarding (alto 52, píldora, latón
 * sólido para la acción principal) porque tienen que sentirse la misma app.
 * `perfil` no publica los suyos en `@/features/profile`, así que de momento
 * viven duplicados aquí: si aparece un tercer sitio que los necesite, súbelos a
 * `src/components/` en vez de copiarlos otra vez.
 */

import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ActionButton({
  label,
  onPress,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}) {
  const theme = useTheme();
  const primary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: theme.brass }
          : { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="bodyStrong" themeColor={primary ? 'onAccent' : 'textSecondary'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.pill,
  },
  pressed: {
    opacity: 0.85,
  },
});
