/**
 * Deck de swipe de los grupos: el mismo gesto que el de Descubrir
 * (`features/discover/swipe-deck.tsx`) —umbral de 110, flick de 800, la carta
 * sigue al dedo y sale por el lado de la decisión—, pero para cualquier carta:
 * aquí son grupos o personas con un puesto, no perfiles con Super Like y Boost.
 *
 * Como allí, el arrastre pertenece a un turno (`turnKey`): la carta decidida se
 * queda fuera y la siguiente nace en el centro sin heredar su desplazamiento.
 * Con «reducir movimiento», la decisión llega igual sin el recorrido.
 */

import { useState, type ReactNode } from 'react';
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

import { Icon } from '@/components/icon';
import { ScalePressable } from '@/components/scale-pressable';
import { Curves, Duration, Elevation, Radii, Spacing, Springs, Stroke } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme, useThemeName } from '@/hooks/use-theme';

import type { Decision } from '@/data';

/** Desplazamiento a partir del cual soltar cuenta como decisión. */
export const SWIPE_THRESHOLD = 110;
/** Velocidad a la que un flick corto también decide. */
export const FLICK_VELOCITY = 800;
const MAX_ROTATION = 10;
const BUTTON_SIZE = 64;
/** Hueco que la carta deja abajo para los botones que flotan encima. */
export const DECISION_ACTIONS_SPACE = BUTTON_SIZE + Spacing.four * 2;

const EXIT_TIMING = { duration: Duration.base, easing: Easing.bezier(...Curves.out) };

/** Identificador del gesto de la carta superior. Lo usan los tests. */
export const GROUP_PAN_TEST_ID = 'group-deck-pan';

/** Qué decide soltar la carta ahí, o `null` si vuelve al centro. */
export function swipeOutcome(translationX: number, velocityX: number): Decision | null {
  'worklet';
  if (translationX > SWIPE_THRESHOLD || velocityX > FLICK_VELOCITY) return 'like';
  if (translationX < -SWIPE_THRESHOLD || velocityX < -FLICK_VELOCITY) return 'pass';
  return null;
}

export function DecisionDeck<T>({
  items,
  keyOf,
  renderCard,
  onDecide,
  disabled = false,
  likeLabel,
  passLabel,
}: {
  items: T[];
  keyOf: (item: T) => string;
  /** `top` es cierto solo en la carta que se puede decidir. */
  renderCard: (item: T, top: boolean) => ReactNode;
  /** Se llama una vez por carta, cuando termina de salir. */
  onDecide: (item: T, decision: Decision) => void;
  /** Ni el gesto ni los botones deciden (p. ej. con un panel abierto sobre la carta). */
  disabled?: boolean;
  likeLabel: string;
  passLabel: string;
}) {
  const theme = useTheme();
  const elevation = Elevation[useThemeName()];
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const owner = useSharedValue<string | null>(null);
  const exited = useSharedValue(false);
  const exiting = useSharedValue(false);

  const top = items.length > 0 ? items[0] : null;
  const topId = top === null ? null : keyOf(top);
  const exitDistance = width + 160;

  // Cada vez que cambia la superior empieza un turno nuevo (estado derivado de
  // las props, ajustado durante el render: la nueva se pinta ya con su turno).
  const [turn, setTurn] = useState({ topId, count: 0 });
  if (turn.topId !== topId) setTurn({ topId, count: turn.count + 1 });
  const turnKey = topId === null ? null : `${turn.count}:${topId}`;

  function settle(item: T, decision: Decision) {
    exiting.set(false);
    onDecide(item, decision);
  }

  /** Toma el arrastre para este turno si aún no era suyo. */
  function claim(key: string | null) {
    'worklet';
    if (owner.get() !== key || exited.get()) {
      owner.set(key);
      exited.set(false);
      translateX.set(0);
      translateY.set(0);
    }
  }

  /** Salida disparada desde los botones. */
  function swipeAway(decision: Decision) {
    if (top === null || disabled || exiting.get()) return;
    const item = top;
    exiting.set(true);
    claim(turnKey);

    if (reduceMotion) {
      exited.set(true);
      settle(item, decision);
      return;
    }
    translateX.set(
      withTiming(decision === 'like' ? exitDistance : -exitDistance, EXIT_TIMING, (finished) => {
        if (!finished) return;
        exited.set(true);
        runOnJS(settle)(item, decision);
      })
    );
  }

  const pan = Gesture.Pan()
    .withTestId(GROUP_PAN_TEST_ID)
    .enabled(top !== null && !disabled)
    .onBegin(() => {
      if (exiting.get() || turnKey === null) return;
      claim(turnKey);
    })
    .onUpdate((event) => {
      if (exiting.get() || owner.get() !== turnKey) return;
      translateX.set(event.translationX);
      translateY.set(event.translationY);
    })
    .onEnd((event) => {
      if (exiting.get() || top === null || owner.get() !== turnKey) return;
      const decision = swipeOutcome(translateX.get(), event.velocityX);

      if (decision === null) {
        translateX.set(reduceMotion ? 0 : withSpring(0, Springs.settle));
        translateY.set(reduceMotion ? 0 : withSpring(0, Springs.settle));
        return;
      }

      exiting.set(true);
      if (reduceMotion) {
        exited.set(true);
        runOnJS(settle)(top, decision);
        return;
      }
      translateX.set(
        withTiming(decision === 'like' ? exitDistance : -exitDistance, EXIT_TIMING, (finished) => {
          if (!finished) return;
          exited.set(true);
          runOnJS(settle)(top, decision);
        })
      );
    });

  const topStyle = useAnimatedStyle(() => {
    const mine = owner.get() === turnKey;
    const x = mine ? translateX.get() : 0;
    const y = mine ? translateY.get() : 0;
    const rotation = interpolate(
      x,
      [-width, 0, width],
      [-MAX_ROTATION, 0, MAX_ROTATION],
      Extrapolation.CLAMP
    );
    return {
      opacity: mine && exited.get() ? 0 : 1,
      transform: [{ translateX: x }, { translateY: y }, { rotate: rotation + 'deg' }],
    };
  });

  const next = items.length > 1 ? items[1] : null;

  return (
    <View style={styles.root}>
      <View style={styles.deck}>
        {next !== null ? (
          <View key={keyOf(next)} aria-hidden style={[styles.card, styles.behind]}>
            {renderCard(next, false)}
          </View>
        ) : null}
        {top !== null ? (
          <GestureDetector key={keyOf(top)} gesture={pan}>
            <Animated.View style={[styles.card, { boxShadow: elevation.raised }, topStyle]}>
              {renderCard(top, true)}
            </Animated.View>
          </GestureDetector>
        ) : null}
      </View>

      {disabled ? null : (
        <View style={styles.actions} pointerEvents="box-none">
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel={passLabel}
            disabled={top === null}
            onPress={() => swipeAway('pass')}
            style={[
              styles.button,
              { backgroundColor: theme.surfaceOpaque, borderColor: theme.border },
            ]}>
            <Icon name="close" size={28} color={theme.danger} strokeWidth={2.4} />
          </ScalePressable>
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel={likeLabel}
            disabled={top === null}
            onPress={() => swipeAway('like')}
            style={[
              styles.button,
              { backgroundColor: theme.surfaceOpaque, borderColor: theme.border },
            ]}>
            <Icon name="heart" size={28} color={theme.brass} fill={theme.brass} />
          </ScalePressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  deck: { flex: 1 },
  card: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: Radii.card,
  },
  // La de detrás no se lee ni se toca: solo ocupa el sitio para el relevo.
  behind: { pointerEvents: 'none', opacity: 0.4, transform: [{ scale: 0.96 }] },
  actions: {
    position: 'absolute',
    right: 0,
    bottom: Spacing.four,
    left: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.five,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.pill,
    borderWidth: Stroke.thin,
  },
});
