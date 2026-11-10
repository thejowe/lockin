/**
 * Lo que comparten los dos decks de swipe —Descubrir (`swipe-deck.tsx`) y los
 * grupos (`features/groups/decision-deck.tsx`)—: los números del gesto, cómo
 * sale la tarjeta y el velo con el corazón o la cruz que la cubre al arrastrar.
 * Viven aquí para que los dos se sientan exactamente igual: si se toca uno, se
 * tocan ambos.
 */

import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { Curves, Duration, Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { BlackCross } from './deck-actions';

import type { SharedValue } from 'react-native-reanimated';

/** Desplazamiento a partir del cual soltar cuenta como decisión. */
export const SWIPE_THRESHOLD = 110;
/**
 * Recorrido en el que el sello pasa de invisible a opaco. Mucho antes que el
 * umbral: el de Like cae sobre el avatar, y a medio aparecer se transparentaba
 * su base y se leían las iniciales debajo.
 */
export const STAMP_FADE = SWIPE_THRESHOLD / 3;
/** Velocidad a la que un flick corto también decide. */
export const FLICK_VELOCITY = 800;
/** Inclinación máxima de la tarjeta, en grados. */
export const MAX_ROTATION = 12;
/** Tamaño del corazón o la cruz que aparece al arrastrar. */
const MARK_SIZE = 120;
/** Intensidad del desenfoque del fondo cuando la tarjeta llega al umbral. */
const VEIL_BLUR = 40;
/** Cuántas tarjetas se pintan a la vez. Las demás no se ven. */
export const VISIBLE_CARDS = 3;
/** Cuánto encoge cada tarjeta por cada puesto que tiene delante. */
export const DEPTH_SCALE = 0.04;
/**
 * Sin desplazamiento vertical: como en Tinder, las de detrás no asoman por
 * debajo de la superior. Solo se ven cuando la de arriba se aparta.
 */
export const DEPTH_OFFSET = 0;
/** Cuánto se apaga cada tarjeta de detrás por puesto de profundidad. */
export const DEPTH_DIM = 0.35;

/** Salida de pantalla: arranca con la velocidad del gesto y frena al final. */
export const EXIT_TIMING = { duration: Duration.base, easing: Easing.bezier(...Curves.out) };

/**
 * Ritmo al que se frena el impulso del dedo al proyectarlo: el de un scroll ágil
 * de iOS. Con él, un flick de 800 px/s lleva la tarjeta unos 80 px más allá.
 */
const DECELERATION = 0.99;

/**
 * Dónde acabaría la tarjeta si se la dejara frenar sola (la función de
 * proyección de Apple, la misma que decide dónde para un scroll). Se decide con
 * este punto y no con el de suelta: así un flick corto lanza la tarjeta, y una
 * soltada más allá del umbral pero volviendo hacia el centro vuelve.
 */
export function projected(position: number, velocity: number): number {
  'worklet';
  return position + ((velocity / 1000) * DECELERATION) / (1 - DECELERATION);
}

/**
 * Pendiente inicial de `Curves.out` (y1 / x1): cuántas veces la velocidad media
 * lleva al arrancar.
 */
const EXIT_LAUNCH = Curves.out[1] / Curves.out[0];

/**
 * Salida que arranca a la velocidad con la que el dedo soltó la tarjeta: sin
 * costura entre arrastre y animación. Un lanzamiento rápido sale rápido; uno
 * lento, en el tope de `Duration.slow`.
 */
export function exitTiming(remaining: number, velocity: number) {
  'worklet';
  const speed = Math.abs(velocity) / 1000;
  const duration = speed > 0 ? (EXIT_LAUNCH * Math.abs(remaining)) / speed : Duration.slow;
  return {
    duration: Math.min(Duration.slow, Math.max(Duration.fast, duration)),
    easing: EXIT_TIMING.easing,
  };
}

/**
 * Velo y sello sobre la tarjeta superior. `offset` es su desplazamiento
 * horizontal (0 si el arrastre no es suyo). El fondo se difumina y oscurece a
 * medida que se arrastra hacia cualquier lado, y encima se forma el corazón o
 * la cruz: crece a la vez que aparece, como algo que se forma bajo el dedo.
 */
export function SwipeOverlay({ offset }: { offset: SharedValue<number> }) {
  const theme = useTheme();

  const likeStyle = useAnimatedStyle(() => {
    const x = offset.get();
    const progress = interpolate(x, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: interpolate(x, [0, STAMP_FADE], [0, 1], Extrapolation.CLAMP),
      transform: [{ scale: 0.6 + 0.4 * progress }],
    };
  });

  const veilStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      Math.abs(offset.get()),
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  const passStyle = useAnimatedStyle(() => {
    const x = offset.get();
    const progress = interpolate(x, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP);
    return {
      opacity: interpolate(x, [-STAMP_FADE, 0], [1, 0], Extrapolation.CLAMP),
      transform: [{ scale: 0.6 + 0.4 * progress }],
    };
  });

  return (
    <>
      <Animated.View testID="swipe-veil" style={[styles.mark, styles.veil, veilStyle]}>
        {Platform.OS === 'android' ? (
          // `BlurView` en Android exige un `BlurTargetView`; aquí basta un velo oscuro.
          <View style={[StyleSheet.absoluteFill, styles.androidVeil]} />
        ) : (
          <BlurView tint="dark" intensity={VEIL_BLUR} style={StyleSheet.absoluteFill} />
        )}
      </Animated.View>

      <Animated.View testID="swipe-mark-like" style={[styles.mark, likeStyle]}>
        <Icon
          name="heart"
          size={MARK_SIZE}
          color={theme.brass}
          fill={theme.brass}
          strokeWidth={2.4}
        />
      </Animated.View>

      <Animated.View testID="swipe-mark-pass" style={[styles.mark, passStyle]}>
        <BlackCross size={MARK_SIZE} edge={theme.text} />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  // Corazón / cruz del gesto: centrados sobre la tarjeta, sin recibir toques.
  mark: {
    position: 'absolute',
    pointerEvents: 'none',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  veil: {
    borderRadius: Radii.card,
    overflow: 'hidden',
  },
  androidVeil: {
    backgroundColor: 'rgba(10, 10, 11, 0.7)',
  },
});
