/**
 * Deck de tarjetas con gesto de swipe.
 *
 * Es el corazón de la identidad del producto, así que el gesto manda: la
 * tarjeta sigue al dedo, se inclina, y al soltar decide por umbral o por
 * velocidad (un flick corto pero rápido también cuenta). Los botones de
 * `DeckActions` disparan exactamente la misma animación de salida para que
 * ambos caminos se sientan iguales.
 *
 * Solo la tarjeta superior escucha el gesto; las de detrás son decorado
 * estático — animarlas no aporta nada al MVP y multiplica el coste por frame.
 */

import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Duration, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { DeckActions } from './deck-actions';
import { ProfileCard } from './profile-card';

import type { Decision, Profile } from '@/data';

/** Desplazamiento a partir del cual soltar cuenta como decisión. */
const SWIPE_THRESHOLD = 110;
/** Velocidad a la que un flick corto también decide. */
const FLICK_VELOCITY = 800;
/** Inclinación máxima de la tarjeta, en grados. */
const MAX_ROTATION = 12;
/** Cuántas tarjetas se pintan a la vez. Las demás no se ven. */
const VISIBLE_CARDS = 3;

const SPRING = { damping: 18, stiffness: 220, mass: 0.6 } as const;

/** Identificador del gesto de la tarjeta superior. Lo usan los tests. */
export const PAN_TEST_ID = 'swipe-deck-pan';

export function SwipeDeck({
  profiles,
  onDecide,
}: {
  profiles: Profile[];
  /** Se llama una vez por tarjeta, cuando la animación de salida termina. */
  onDecide: (profile: Profile, decision: Decision) => void;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  /** Bloquea nuevas decisiones mientras la tarjeta actual sale de pantalla. */
  const exiting = useSharedValue(false);

  const top = profiles.length > 0 ? profiles[0] : null;
  const exitDistance = width + 160;

  /**
   * Cierra la decisión: devuelve la tarjeta al centro ANTES de avisar al padre,
   * para que la siguiente entre ya colocada y no aparezca fuera de pantalla.
   */
  function settle(profile: Profile, decision: Decision) {
    translateX.set(0);
    translateY.set(0);
    exiting.set(false);
    onDecide(profile, decision);
  }

  /** Salida animada disparada desde los botones (el gesto tiene la suya). */
  function swipeAway(decision: Decision) {
    if (top === null || exiting.get()) return;
    const profile = top;

    exiting.set(true);
    translateX.set(
      withTiming(
        decision === 'like' ? exitDistance : -exitDistance,
        { duration: Duration.base },
        (finished) => {
          if (finished) runOnJS(settle)(profile, decision);
        }
      )
    );
  }

  const pan = Gesture.Pan()
    // El id es la única forma de alcanzar el gesto desde un test:
    // `getByGestureTestId` de `react-native-gesture-handler/jest-utils`.
    .withTestId(PAN_TEST_ID)
    .enabled(top !== null)
    .onUpdate((event) => {
      if (exiting.get()) return;
      translateX.set(event.translationX);
      translateY.set(event.translationY);
    })
    .onEnd((event) => {
      if (exiting.get() || top === null) return;

      const liked = translateX.get() > SWIPE_THRESHOLD || event.velocityX > FLICK_VELOCITY;
      const passed = translateX.get() < -SWIPE_THRESHOLD || event.velocityX < -FLICK_VELOCITY;

      if (!liked && !passed) {
        translateX.set(withSpring(0, SPRING));
        translateY.set(withSpring(0, SPRING));
        return;
      }

      const decision: Decision = liked ? 'like' : 'pass';
      exiting.set(true);

      // La tarjeta mantiene el arco del gesto al salir: sube o baja según iba.
      translateY.set(
        withTiming(translateY.get() + event.velocityY * 0.1, { duration: Duration.base })
      );
      translateX.set(
        withTiming(
          liked ? exitDistance : -exitDistance,
          { duration: Duration.base },
          (finished) => {
            if (finished) runOnJS(settle)(top, decision);
          }
        )
      );
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotation = interpolate(
      translateX.get(),
      [-width, 0, width],
      [-MAX_ROTATION, 0, MAX_ROTATION],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { translateX: translateX.get() },
        { translateY: translateY.get() },
        { rotate: rotation + 'deg' },
      ],
    };
  });

  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.get(), [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));

  const passStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.get(), [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  // Se pintan del fondo hacia delante: la superior es la última y queda encima.
  const stack = profiles.slice(0, VISIBLE_CARDS).reverse();

  return (
    <View style={styles.root}>
      <View style={styles.deck}>
        {stack.map((profile, position) => {
          const depth = stack.length - 1 - position;

          if (depth > 0) {
            return (
              <View
                key={profile.id}
                // Se pintan detrás y no se pueden decidir todavía: para un
                // lector de pantalla solo son ruido delante de la tarjeta real.
                aria-hidden
                style={[
                  styles.card,
                  styles.cardBehind,
                  { transform: [{ scale: 1 - depth * 0.04 }, { translateY: depth * 14 }] },
                ]}>
                <ProfileCard profile={profile} />
              </View>
            );
          }

          return (
            <GestureDetector key={profile.id} gesture={pan}>
              <Animated.View style={[styles.card, cardStyle]}>
                <ProfileCard profile={profile} />

                <Animated.View
                  style={[
                    styles.badge,
                    styles.badgeLike,
                    { backgroundColor: theme.tealSoft, borderColor: theme.teal },
                    likeStyle,
                  ]}>
                  <ThemedText type="label" style={{ color: theme.teal }}>
                    Like
                  </ThemedText>
                </Animated.View>

                <Animated.View
                  style={[
                    styles.badge,
                    styles.badgePass,
                    { backgroundColor: theme.dangerSoft, borderColor: theme.danger },
                    passStyle,
                  ]}>
                  <ThemedText type="label" style={{ color: theme.danger }}>
                    Pasar
                  </ThemedText>
                </Animated.View>
              </Animated.View>
            </GestureDetector>
          );
        })}
      </View>

      <DeckActions onDecide={swipeAway} disabled={top === null} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: Spacing.four,
  },
  deck: {
    flex: 1,
  },
  card: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  cardBehind: {
    pointerEvents: 'none',
  },
  badge: {
    position: 'absolute',
    pointerEvents: 'none',
    top: Spacing.four,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: 2,
  },
  badgeLike: {
    left: Spacing.four,
    transform: [{ rotate: '-10deg' }],
  },
  badgePass: {
    right: Spacing.four,
    transform: [{ rotate: '10deg' }],
  },
});
