/**
 * Deck de swipe de los grupos. Se siente exactamente igual que el de Descubrir
 * (`features/discover/swipe-deck.tsx`): mismos números y misma salida
 * (`features/discover/swipe-motion.tsx`), el mismo velo con el corazón o la
 * cruz cubriendo la carta al arrastrarla, la misma pila de detrás que sube con
 * el arrastre y los mismos botones de Pasar y Like, que crecen y se rellenan
 * hacia el lado al que va la carta. Lo único distinto es qué hay en la carta:
 * aquí son grupos o personas con un puesto, sin Super Like, Deshacer ni Boost.
 *
 * Como allí, el arrastre pertenece a un turno (`turnKey`): la carta decidida se
 * queda fuera y la siguiente nace en el centro sin heredar su desplazamiento.
 * Con «reducir movimiento», la decisión llega igual sin el recorrido.
 */

import { useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Elevation, Radii, Spacing, Springs } from '@/constants/theme';
import { ActionButton } from '@/features/discover/deck-actions';
import {
  DEPTH_DIM,
  DEPTH_OFFSET,
  DEPTH_SCALE,
  EXIT_TIMING,
  exitTiming,
  FLICK_VELOCITY,
  MAX_ROTATION,
  projected,
  SWIPE_THRESHOLD,
  SwipeOverlay,
  VISIBLE_CARDS,
} from '@/features/discover/swipe-motion';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme, useThemeName } from '@/hooks/use-theme';

import type { SharedValue } from 'react-native-reanimated';
import type { Decision } from '@/data';

export { FLICK_VELOCITY, SWIPE_THRESHOLD };

const BUTTON_SIZE = 64;
/** Hueco entre Pasar y Like: el mismo que deja Super Like en el deck de Descubrir. */
const MIDDLE_SPACE = 48;
/** Hueco que la carta deja abajo para los botones que flotan encima. */
export const DECISION_ACTIONS_SPACE = BUTTON_SIZE + Spacing.four * 2;

/** Identificador del gesto de la carta superior. Lo usan los tests. */
export const GROUP_PAN_TEST_ID = 'group-deck-pan';

/**
 * Qué decide soltar la carta ahí, o `null` si vuelve al centro. Como en
 * Descubrir, decide el punto donde la carta acabaría frenando sola, no el de suelta.
 */
export function swipeOutcome(translationX: number, velocityX: number): Decision | null {
  'worklet';
  const landing = projected(translationX, velocityX);
  if (landing > SWIPE_THRESHOLD || velocityX > FLICK_VELOCITY) return 'like';
  if (landing < -SWIPE_THRESHOLD || velocityX < -FLICK_VELOCITY) return 'pass';
  return null;
}

/** Estado del arrastre, compartido entre el hilo de UI y el de JS. */
interface Drag {
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  owner: SharedValue<string | null>;
  exited: SharedValue<boolean>;
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
  const elevation = Elevation[useThemeName()];
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const owner = useSharedValue<string | null>(null);
  const exited = useSharedValue(false);
  const drag: Drag = { translateX, translateY, owner, exited };
  const exiting = useSharedValue(false);

  const top = items.length > 0 ? items[0] : null;
  const topId = top === null ? null : keyOf(top);
  const exitDistance = width + 160;

  // Cada vez que cambia la superior empieza un turno nuevo (estado derivado de
  // las props, ajustado durante el render: la nueva se pinta ya con su turno).
  const [turn, setTurn] = useState({ topId, count: 0 });
  if (turn.topId !== topId) setTurn({ topId, count: turn.count + 1 });
  const turnKey = topId === null ? null : `${turn.count}:${topId}`;

  // De -1 (pasar) a 1 (like): lo leen los botones para crecer y rellenarse.
  const swipeProgress = useDerivedValue(() => {
    if (turnKey === null || owner.get() !== turnKey || exited.get()) return 0;
    return interpolate(
      translateX.get(),
      [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
      [-1, 0, 1],
      Extrapolation.CLAMP
    );
  });

  // Desplazamiento de la superior para el velo y el sello: 0 si el arrastre no es suyo.
  const offset = useDerivedValue(() => (owner.get() === turnKey ? translateX.get() : 0));

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
        // Vuelve al sitio con la velocidad que traía el dedo.
        translateX.set(
          reduceMotion ? 0 : withSpring(0, { ...Springs.settle, velocity: event.velocityX })
        );
        translateY.set(
          reduceMotion ? 0 : withSpring(0, { ...Springs.settle, velocity: event.velocityY })
        );
        return;
      }

      exiting.set(true);
      if (reduceMotion) {
        exited.set(true);
        runOnJS(settle)(top, decision);
        return;
      }

      // La carta mantiene el arco del gesto al salir: sube o baja según iba.
      const exitX = decision === 'like' ? exitDistance : -exitDistance;
      const timing = exitTiming(exitX - translateX.get(), event.velocityX);
      translateY.set(withTiming(translateY.get() + event.velocityY * 0.1, timing));
      translateX.set(
        withTiming(exitX, timing, (finished) => {
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
      transform: [{ translateX: x }, { translateY: y }, { rotate: rotation + 'deg' }, { scale: 1 }],
    };
  });

  // Se pintan del fondo hacia delante: la superior es la última y queda encima.
  const stack = items
    .slice(0, VISIBLE_CARDS)
    .map((item, index) => ({ item, index }))
    .reverse();

  return (
    <View style={styles.root}>
      <View style={styles.deck}>
        {stack.map(({ item, index }) =>
          index > 0 ? (
            <BehindCard key={keyOf(item)} index={index} frontKey={turnKey} drag={drag}>
              {renderCard(item, false)}
            </BehindCard>
          ) : (
            <GestureDetector key={keyOf(item)} gesture={pan}>
              <Animated.View
                style={[styles.card, styles.cardTop, { boxShadow: elevation.raised }, topStyle]}>
                {renderCard(item, true)}
                <SwipeOverlay offset={offset} />
              </Animated.View>
            </GestureDetector>
          )
        )}
      </View>

      {disabled ? null : (
        <View style={styles.actions} pointerEvents="box-none">
          <ActionButton
            label={passLabel}
            tone="pass"
            disabled={top === null}
            progress={swipeProgress}
            onPress={() => swipeAway('pass')}
          />
          <View style={styles.middle} />
          <ActionButton
            label={likeLabel}
            tone="like"
            disabled={top === null}
            progress={swipeProgress}
            onPress={() => swipeAway('like')}
          />
        </View>
      )}
    </View>
  );
}

/**
 * Una de detrás, como en Descubrir: se apaga y encoge con la profundidad, y la
 * de justo detrás sube hacia delante a la par que el arrastre de la superior.
 */
function BehindCard({
  index,
  frontKey,
  drag,
  children,
}: {
  index: number;
  frontKey: string | null;
  drag: Drag;
  children: ReactNode;
}) {
  const theme = useTheme();
  const { translateX, owner, exited } = drag;

  const contentStyle = useAnimatedStyle(() => {
    const frontIsDragged = owner.get() !== null && owner.get() === frontKey;
    const frontGone = frontIsDragged && exited.get();
    const depth = frontGone ? index - 1 : index;
    const progress =
      index === 1 && frontIsDragged && !frontGone
        ? interpolate(Math.abs(translateX.get()), [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP)
        : 0;
    return { opacity: interpolate(depth - progress, [0, 1], [1, 0], Extrapolation.CLAMP) };
  });

  const style = useAnimatedStyle(() => {
    const frontIsDragged = owner.get() !== null && owner.get() === frontKey;
    const frontGone = frontIsDragged && exited.get();
    const depth = frontGone ? index - 1 : index;
    const progress =
      index === 1 && frontIsDragged && !frontGone
        ? interpolate(Math.abs(translateX.get()), [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP)
        : 0;
    return {
      opacity: 1 - DEPTH_DIM * (depth - progress),
      transform: [
        { translateX: 0 },
        { translateY: DEPTH_OFFSET * (depth - progress) },
        { rotate: '0deg' },
        { scale: 1 - DEPTH_SCALE * (depth - progress) },
      ],
    };
  });

  return (
    <Animated.View
      aria-hidden
      style={[styles.card, styles.cardBehind, { backgroundColor: theme.surfaceOpaque }, style]}>
      <Animated.View style={[styles.behindContent, contentStyle]}>{children}</Animated.View>
    </Animated.View>
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
  },
  cardTop: { borderRadius: Radii.card },
  // Las de detrás no se leen ni se tocan hasta que suben.
  cardBehind: { pointerEvents: 'none', borderRadius: Radii.card, overflow: 'hidden' },
  behindContent: { flex: 1 },
  actions: {
    position: 'absolute',
    right: 0,
    bottom: Spacing.four,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  middle: { width: MIDDLE_SPACE },
});
