/**
 * Deck de tarjetas con gesto de swipe.
 *
 * Es el corazón de la identidad del producto, así que el gesto manda: la
 * tarjeta sigue al dedo, se inclina, y al soltar decide por umbral o por
 * velocidad (un flick corto pero rápido también cuenta). Los botones de
 * `DeckActions` disparan exactamente la misma animación de salida para que
 * ambos caminos se sientan iguales.
 *
 * Solo la tarjeta superior escucha el gesto. La de justo detrás sube hacia
 * delante a medida que la de arriba se aparta (escala y desplazamiento ligados
 * al arrastre, no a un temporizador): cuando la superior sale, la siguiente ya
 * está en su sitio y el relevo no pega un salto. La tercera es decorado
 * estático — animarla no se ve y cuesta por frame.
 *
 * La superior lleva la sombra `raised`: es lo único del deck que se coge con
 * la mano, y tiene que leerse por encima de las demás.
 *
 * Con «reducir movimiento» activado en el sistema, la tarjeta llega al MISMO
 * estado final sin el recorrido: misma decisión, mismo `onDecide`, misma lógica
 * de match aguas arriba. Lo que se apaga es solo lo que se mueve solo —la salida
 * de pantalla y el rebote de vuelta al centro—, nunca el seguimiento del dedo:
 * eso es manipulación directa y quitarla dejaría el deck sin feedback.
 */

import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Curves, Duration, Elevation, Radii, Spacing, Springs, Stroke } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme, useThemeName } from '@/hooks/use-theme';

import { DeckActions } from './deck-actions';
import { ProfileCard } from './profile-card';

import type { Decision, Profile, Specialty } from '@/data';

/** Desplazamiento a partir del cual soltar cuenta como decisión. */
const SWIPE_THRESHOLD = 110;
/** Velocidad a la que un flick corto también decide. */
const FLICK_VELOCITY = 800;
/** Inclinación máxima de la tarjeta, en grados. */
const MAX_ROTATION = 12;
/** Cuántas tarjetas se pintan a la vez. Las demás no se ven. */
const VISIBLE_CARDS = 3;
/** Cuánto encoge y baja cada tarjeta por cada puesto que tiene delante. */
const DEPTH_SCALE = 0.04;
const DEPTH_OFFSET = 14;

/** Salida de pantalla: arranca con la velocidad del gesto y frena al final. */
const EXIT_TIMING = { duration: Duration.base, easing: Easing.bezier(...Curves.out) };

/** Identificador del gesto de la tarjeta superior. Lo usan los tests. */
export const PAN_TEST_ID = 'swipe-deck-pan';

export function SwipeDeck({
  profiles,
  onDecide,
  viewerSpecialties,
}: {
  profiles: Profile[];
  /** Se llama una vez por tarjeta, cuando la animación de salida termina. */
  onDecide: (profile: Profile, decision: Decision) => void;
  /** Lo que domina quien swipea. Solo lo reenvía a la tarjeta, que lo resalta. */
  viewerSpecialties?: Specialty[];
}) {
  const theme = useTheme();
  const elevation = Elevation[useThemeName()];
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();

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

    if (reduceMotion) {
      settle(profile, decision);
      return;
    }

    translateX.set(
      withTiming(decision === 'like' ? exitDistance : -exitDistance, EXIT_TIMING, (finished) => {
        if (finished) runOnJS(settle)(profile, decision);
      })
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
        translateX.set(reduceMotion ? 0 : withSpring(0, Springs.settle));
        translateY.set(reduceMotion ? 0 : withSpring(0, Springs.settle));
        return;
      }

      const decision: Decision = liked ? 'like' : 'pass';
      exiting.set(true);

      if (reduceMotion) {
        // `settle` deja la tarjeta en el centro y avisa al padre: el deck pasa a
        // la siguiente sin que nada recorra la pantalla.
        runOnJS(settle)(top, decision);
        return;
      }

      // La tarjeta mantiene el arco del gesto al salir: sube o baja según iba.
      translateY.set(withTiming(translateY.get() + event.velocityY * 0.1, EXIT_TIMING));
      translateX.set(
        withTiming(liked ? exitDistance : -exitDistance, EXIT_TIMING, (finished) => {
          if (finished) runOnJS(settle)(top, decision);
        })
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

  /** La de detrás avanza hasta el sitio de la superior según se aparta esta. */
  const nextStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      Math.abs(translateX.get()),
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { scale: 1 - DEPTH_SCALE * (1 - progress) },
        { translateY: DEPTH_OFFSET * (1 - progress) },
      ],
    };
  });

  // El sello crece un poco a la vez que aparece: se lee como un tampón que baja
  // sobre la tarjeta, no como un texto que se enciende.
  const likeStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      translateX.get(),
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity: progress,
      transform: [{ rotate: '-10deg' }, { scale: 0.85 + 0.15 * progress }],
    };
  });

  const passStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      translateX.get(),
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity: progress,
      transform: [{ rotate: '10deg' }, { scale: 0.85 + 0.15 * progress }],
    };
  });

  // Se pintan del fondo hacia delante: la superior es la última y queda encima.
  const stack = profiles.slice(0, VISIBLE_CARDS).reverse();

  return (
    <View style={styles.root}>
      <View style={styles.deck}>
        {stack.map((profile, position) => {
          const depth = stack.length - 1 - position;

          if (depth > 0) {
            return (
              <Animated.View
                key={profile.id}
                // Se pintan detrás y no se pueden decidir todavía: para un
                // lector de pantalla solo son ruido delante de la tarjeta real.
                aria-hidden
                style={[
                  styles.card,
                  styles.cardBehind,
                  depth === 1
                    ? nextStyle
                    : {
                        transform: [
                          { scale: 1 - depth * DEPTH_SCALE },
                          { translateY: depth * DEPTH_OFFSET },
                        ],
                      },
                ]}>
                <ProfileCard profile={profile} viewerSpecialties={viewerSpecialties} />
              </Animated.View>
            );
          }

          return (
            <GestureDetector key={profile.id} gesture={pan}>
              <Animated.View
                style={[styles.card, styles.cardTop, { boxShadow: elevation.raised }, cardStyle]}>
                <ProfileCard profile={profile} viewerSpecialties={viewerSpecialties} />

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
  cardTop: {
    borderRadius: Radii.card,
  },
  badge: {
    position: 'absolute',
    pointerEvents: 'none',
    top: Spacing.four,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: Stroke.strong,
  },
  badgeLike: {
    left: Spacing.four,
  },
  badgePass: {
    right: Spacing.four,
  },
});
