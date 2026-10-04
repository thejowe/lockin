/**
 * Botones de pass/like.
 *
 * No son un adorno: el gesto no es accesible para todo el mundo (lectores de
 * pantalla, movilidad reducida, ratón en web), así que toda decisión posible
 * con el dedo tiene que poder tomarse aquí también.
 *
 * Pasar es cristal, Like es brasa sólida: los dos dicen su nombre, pero solo
 * uno es «lo siguiente que haces» si la tarjeta te convence.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { glassStyle } from '@/components/glass';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Control, Opacity, Radii, Spacing } from '@/constants/theme';
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
        tone="pass"
        disabled={disabled}
        onPress={() => onDecide('pass')}
      />
      <ActionButton
        label="Like"
        hint="Guardar este perfil como interesante"
        tone="like"
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
  tone: 'pass' | 'like';
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const press = usePressScale();
  const like = tone === 'like';
  const color = like ? theme.onAccent : theme.text;

  return (
    <Animated.View style={[like ? styles.likeSlot : styles.passSlot, press.style]}>
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
          like
            ? { backgroundColor: theme.brass }
            : glassStyle(theme, { elevated: true, radius: Radii.pill }),
          disabled ? styles.disabled : pressed && styles.pressed,
        ]}>
        <Icon name={like ? 'heart' : 'close'} size={20} color={color} strokeWidth={2} />
        <ThemedText type="bodyStrong" style={{ color }}>
          {label}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two + Spacing.one,
  },
  passSlot: {
    flex: 2,
  },
  likeSlot: {
    flex: 3,
  },
  button: {
    minHeight: Control.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radii.pill,
  },
  pressed: {
    opacity: Opacity.pressed,
  },
  disabled: {
    opacity: Opacity.disabled,
  },
});
