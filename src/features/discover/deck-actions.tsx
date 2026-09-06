/**
 * Botones de pass/like.
 *
 * No son un adorno: el gesto no es accesible para todo el mundo (lectores de
 * pantalla, movilidad reducida, ratón en web), así que toda decisión posible
 * con el dedo tiene que poder tomarse aquí también.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { Decision } from '@/data';

export function DeckActions({
  onDecide,
  disabled = false,
}: {
  onDecide: (decision: Decision) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <ActionButton
        label="Pasar"
        hint="Descartar este perfil"
        tone="danger"
        disabled={disabled}
        onPress={() => onDecide('pass')}
      />
      <ActionButton
        label="Like"
        hint="Guardar este perfil como interesante"
        tone="teal"
        disabled={disabled}
        onPress={() => onDecide('like')}
      />
    </View>
  );
}

function ActionButton({
  label,
  hint,
  tone,
  disabled,
  onPress,
}: {
  label: string;
  hint: string;
  tone: 'danger' | 'teal';
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const background = tone === 'danger' ? theme.dangerSoft : theme.tealSoft;
  const color = tone === 'danger' ? theme.danger : theme.teal;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, borderColor: color },
        (pressed || disabled) && styles.buttonDimmed,
      ]}>
      <ThemedText type="label" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  buttonDimmed: {
    opacity: 0.55,
  },
});
