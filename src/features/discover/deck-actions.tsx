/**
 * Botones de pass/like.
 *
 * No son un adorno: el gesto no es accesible para todo el mundo (lectores de
 * pantalla, movilidad reducida, ratón en web), así que toda decisión posible
 * con el dedo tiene que poder tomarse aquí también.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Control, Opacity, Radii, Spacing, Stroke } from '@/constants/theme';
import { usePressScale } from '@/hooks/use-press-scale';
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
  const press = usePressScale();
  const background = tone === 'danger' ? theme.dangerSoft : theme.tealSoft;
  const color = tone === 'danger' ? theme.danger : theme.teal;

  return (
    <Animated.View style={[styles.slot, press.style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: background, borderColor: color },
          disabled ? styles.disabled : pressed && styles.pressed,
        ]}>
        <ThemedText type="label" style={{ color }}>
          {label}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  slot: {
    flex: 1,
  },
  button: {
    minHeight: Control.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.pill,
    borderWidth: Stroke.hairline,
  },
  pressed: {
    opacity: Opacity.pressed,
  },
  disabled: {
    opacity: Opacity.disabled,
  },
});
