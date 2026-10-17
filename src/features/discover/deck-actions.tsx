/**
 * Botones de pass/like, flotando sobre la tarjeta como en Tinder.
 *
 * No son un adorno: el gesto no es accesible para todo el mundo (lectores de
 * pantalla, movilidad reducida, ratón en web), así que toda decisión posible
 * con el dedo tiene que poder tomarse aquí también.
 *
 * Solo icono, sin círculo alrededor, y cada uno dice su nombre y su efecto al
 * lector de pantalla. Responden al arrastre de la tarjeta: al tirar a la derecha
 * el corazón crece y se llena del naranja de marca; a la izquierda, la cruz
 * crece y se llena de negro (con un canto claro, para que se lea sobre el
 * fundido oscuro de la tarjeta). `progress` va de -1 (pasar) a 1 (like).
 */

import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Icon } from '@/components/icon';
import { Opacity, Spacing } from '@/constants/theme';
import { usePressScale } from '@/hooks/use-press-scale';
import { useTheme } from '@/hooks/use-theme';

import type { SharedValue } from 'react-native-reanimated';
import type { Decision } from '@/data';

/** Zona pulsable de cada botón. */
const BUTTON_SIZE = 64;
/** Tamaño del icono en reposo. */
const ICON_SIZE = 34;
/** Cuánto crece el icono cuando el arrastre llega al umbral. */
const MAX_GROWTH = 0.6;

/**
 * Alto que ocupan los botones, con su margen inferior: la tarjeta deja ese
 * hueco abajo para que su texto no quede debajo.
 */
export const DECK_ACTIONS_SPACE = BUTTON_SIZE + Spacing.four;

export function DeckActions({
  onDecide,
  disabled = false,
  progress,
}: {
  onDecide: (decision: Decision) => void;
  disabled?: boolean;
  /** Arrastre de la tarjeta superior, de -1 (pasar) a 1 (like). Sin él, los iconos no reaccionan. */
  progress?: SharedValue<number>;
}) {
  const idle = useSharedValue(0);
  const value = progress ?? idle;

  return (
    <View style={styles.row}>
      <ActionButton
        label="Pasar"
        hint="Descartar este perfil"
        tone="pass"
        disabled={disabled}
        progress={value}
        onPress={() => onDecide('pass')}
      />
      <ActionButton
        label="Like"
        hint="Guardar este perfil como interesante"
        tone="like"
        disabled={disabled}
        progress={value}
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
  progress,
  onPress,
}: {
  label: string;
  hint: string;
  tone: 'pass' | 'like';
  disabled: boolean;
  progress: SharedValue<number>;
  onPress: () => void;
}) {
  const theme = useTheme();
  const press = usePressScale();
  const like = tone === 'like';

  // 0 en reposo, 1 con la tarjeta en el umbral hacia el lado de este botón.
  const reach = useAnimatedStyle(() => {
    const amount = interpolate(
      like ? progress.get() : -progress.get(),
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP
    );
    return { transform: [{ scale: 1 + MAX_GROWTH * amount }] };
  });
  const filled = useAnimatedStyle(() => {
    const amount = interpolate(
      like ? progress.get() : -progress.get(),
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP
    );
    return { opacity: amount };
  });

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
          // Respuesta al toque que no se mueve: vale también con «reducir movimiento».
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
        ]}>
        <Animated.View style={[styles.icon, reach]}>
          {like ? (
            <>
              <Icon name="heart" size={ICON_SIZE} color={theme.brass} strokeWidth={2.4} />
              <Animated.View style={[StyleSheet.absoluteFill, filled]}>
                <Icon
                  name="heart"
                  size={ICON_SIZE}
                  color={theme.brass}
                  fill={theme.brass}
                  strokeWidth={2.4}
                />
              </Animated.View>
            </>
          ) : (
            <>
              <Icon name="close" size={ICON_SIZE} color={theme.text} strokeWidth={2.4} />
              <Animated.View style={[StyleSheet.absoluteFill, filled]}>
                <BlackCross size={ICON_SIZE} edge={theme.text} />
              </Animated.View>
            </>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** La cruz rellena de negro: un trazo grueso y claro debajo hace de canto y la separa del fondo. */
export function BlackCross({ size, edge }: { size: number; edge: string }) {
  const d = 'M6 6l12 12M18 6L6 18';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} stroke={edge} strokeWidth={5.2} strokeLinecap="round" fill="none" />
      <Path d={d} stroke="#000000" strokeWidth={3.4} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.six,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: Opacity.disabled,
  },
});
