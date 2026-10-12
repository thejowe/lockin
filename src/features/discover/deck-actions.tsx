/**
 * Botones de pass/like, redondos y flotando sobre la tarjeta como en Tinder.
 *
 * No son un adorno: el gesto no es accesible para todo el mundo (lectores de
 * pantalla, movilidad reducida, ratón en web), así que toda decisión posible
 * con el dedo tiene que poder tomarse aquí también.
 *
 * Solo icono, pero cada uno dice su nombre y su efecto al lector de pantalla.
 * Son cristal oscuro con el icono en su color —alerta para pasar, brasa para
 * el like— y al pulsarlos se tiñen de ese color, igual que en Tinder.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { glassStyle } from '@/components/glass';
import { Icon } from '@/components/icon';
import { Opacity, Radii, Spacing } from '@/constants/theme';
import { usePressScale } from '@/hooks/use-press-scale';
import { useTheme } from '@/hooks/use-theme';

import type { Decision } from '@/data';

/** Diámetro de cada botón. */
const BUTTON_SIZE = 64;

/**
 * Alto que ocupan los botones, con su margen inferior: la tarjeta deja ese
 * hueco abajo para que su texto no quede debajo.
 */
export const DECK_ACTIONS_SPACE = BUTTON_SIZE + Spacing.four;

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
  const color = like ? theme.brass : theme.danger;
  const pressedFill = like ? theme.brassSoft : theme.dangerSoft;

  return (
    <Animated.View style={press.style}>
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
          glassStyle(theme, { elevated: true, floating: true, radius: Radii.pill }),
          { backgroundColor: theme.surfaceOpaque },
          pressed && !disabled && { backgroundColor: pressedFill, borderColor: color },
          disabled && styles.disabled,
        ]}>
        <Icon name={like ? 'heart' : 'close'} size={30} color={color} strokeWidth={2.4} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.five,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: Opacity.disabled,
  },
});
