/**
 * Mini tutorial de los botones del deck (Deshacer, Super Like, Boost y, al
 * final, Filtros).
 *
 * Sale justo después de la mano que enseña a tocar la tarjeta (`tap-hint.tsx`):
 * cada toque en pantalla pasa al siguiente botón. Cada paso marca el botón con
 * un círculo y una flecha que lleva a una explicación corta.
 *
 * Se recuerda en `AsyncStorage` (comodidad de este teléfono). Si no se puede
 * leer, no se enseña.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Duration, Radii, Spacing, Stroke } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

/** Como la mano de la tarjeta: de cada cuenta, no del teléfono. */
export const buttonsTourKey = (userId: string) => `cofounder.hint.deck-buttons.seen.${userId}`;

export const TOUR_STEPS = [
  {
    title: 'Deshacer',
    text: 'Recupera el último perfil que descartaste. Es de Premium.',
  },
  {
    title: 'Super Like',
    text: 'Le dices que te interesa mucho. Destaca más que un like.',
  },
  {
    title: 'Boost',
    text: 'Tu perfil aparece antes durante 30 minutos. Es de Premium.',
  },
  {
    title: 'Filtros',
    text: 'Busca por especialidad y zona horaria. El resto de filtros son de Premium.',
  },
] as const

/** Último paso: no marca un botón de la fila sino «Filtros», arriba del deck. */
export const FILTERS_STEP = TOUR_STEPS.length - 1;

/** Paso actual (índice en `TOUR_STEPS`) o `null` si no hay que enseñarlo. */
export function useButtonsTour(ready: boolean, userId: string | null): { step: number | null; next: () => void } {
  const [unseen, setUnseen] = useState(false);
  const [index, setIndex] = useState(0);
  const finished = useRef(false);

  useEffect(() => {
    if (userId === null) return;
    let alive = true;
    AsyncStorage.getItem(buttonsTourKey(userId)).then(
      (seen) => {
        if (alive && seen === null && !finished.current) setUnseen(true);
      },
      () => undefined
    );
    return () => {
      alive = false;
    };
  }, [userId]);

  const next = useCallback(() => {
    setIndex((current) => {
      if (current < TOUR_STEPS.length - 1) return current + 1;
      finished.current = true;
      setUnseen(false);
      if (userId !== null) {
        void AsyncStorage.setItem(buttonsTourKey(userId), '1').catch(() => undefined);
      }
      return current;
    });
  }, [userId]);

  return { step: ready && unseen && userId !== null ? index : null, next };
}

export interface TourTarget {
  x: number;
  y: number;
  width: number;
  height: number;
}

const RING = 58;
const ARROW_H = 30;
const BUBBLE_W = 230;

/** Latido suave del círculo; con «reducir movimiento» se queda quieto. */
function usePulse() {
  const reduceMotion = useReduceMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 700, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
    return () => cancelAnimation(pulse);
  }, [reduceMotion, pulse]);

  return useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.1 }],
  }));
}

/**
 * Pasos 0–2: círculo + flecha + explicación sobre el botón del paso. Va dentro de la fila
 * de botones: `target` y `rowWidth`/`rowHeight` están en sus coordenadas, y
 * `rowX` es la posición de la fila en la ventana para no salirse por los lados.
 */
export function TourSpotlight({
  step,
  target,
  rowX,
  rowHeight,
  windowWidth,
}: {
  step: number;
  target: TourTarget;
  rowX: number;
  rowHeight: number;
  windowWidth: number;
}) {
  const theme = useTheme();
  const ringStyle = usePulse();

  const info = TOUR_STEPS[step];
  const cx = target.x + target.width / 2;
  const ringTop = target.y + target.height / 2 - RING / 2;
  const margin = Spacing.three;
  const bubbleLeft = Math.min(
    Math.max(cx - BUBBLE_W / 2, margin - rowX),
    windowWidth - margin - rowX - BUBBLE_W
  );
  const last = step === TOUR_STEPS.length - 1;

  return (
    <View testID="buttons-tour" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        key={step}
        entering={FadeIn.duration(Duration.base)}
        exiting={FadeOut.duration(Duration.fast)}
        style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            styles.ring,
            { left: cx - RING / 2, top: ringTop, borderColor: theme.brass },
            ringStyle,
          ]}
        />
        <View style={[styles.arrow, { left: cx - 8, bottom: rowHeight - ringTop }]}>
          <Svg width={16} height={ARROW_H} viewBox="0 0 16 30">
            <Path
              d="M8 28V4M2 10l6-7 6 7"
              stroke={theme.brass}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </View>
        <View
          style={[
            styles.bubble,
            {
              left: bubbleLeft,
              bottom: rowHeight - ringTop + ARROW_H,
              backgroundColor: theme.surfaceOpaque,
              borderColor: theme.border,
            },
          ]}>
          <ThemedText type="smallBold">{info.title}</ThemedText>
          <ThemedText type="small">{info.text}</ThemedText>
          <ThemedText type="small" style={styles.more}>
            {step + 1}/{TOUR_STEPS.length} · {last ? 'Toca para empezar' : 'Toca para seguir'}
          </ThemedText>
        </View>
      </Animated.View>
    </View>
  );
}

const FILTERS_RING_X = 12;
const FILTERS_RING_Y = 8;

/**
 * Último paso: marca el botón «Filtros» (`anchorRef`), que vive fuera del deck,
 * con un círculo, una flecha hacia arriba y la explicación debajo. Se pinta a
 * pantalla completa y mide en ventana tanto su propio origen como el del botón,
 * así no depende de dónde esté montado.
 */
export function FiltersSpotlight({ anchorRef }: { anchorRef: RefObject<ComponentRef<typeof View> | null> }) {
  const theme = useTheme();
  const ringStyle = usePulse();
  const { width: windowWidth } = useWindowDimensions();
  const rootRef = useRef<ComponentRef<typeof View>>(null);
  const [placed, setPlaced] = useState<{ originX: number; target: TourTarget } | null>(null);

  useEffect(() => {
    let alive = true;
    rootRef.current?.measureInWindow((originX, originY) => {
      anchorRef.current?.measureInWindow((x, y, width, height) => {
        if (alive) setPlaced({ originX, target: { x: x - originX, y: y - originY, width, height } });
      });
    });
    return () => {
      alive = false;
    };
  }, [anchorRef]);

  const info = TOUR_STEPS[FILTERS_STEP];
  const margin = Spacing.three;
  let content = null;
  if (placed) {
    const { originX, target } = placed;
    const cx = target.x + target.width / 2;
    const ringTop = target.y - FILTERS_RING_Y;
    const arrowTop = ringTop + target.height + FILTERS_RING_Y * 2;
    const bubbleLeft = Math.min(
      Math.max(cx - BUBBLE_W / 2, margin - originX),
      windowWidth - margin - originX - BUBBLE_W
    );
    content = (
      <Animated.View
        entering={FadeIn.duration(Duration.base)}
        exiting={FadeOut.duration(Duration.fast)}
        style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            styles.ring,
            {
              left: target.x - FILTERS_RING_X,
              top: ringTop,
              width: target.width + FILTERS_RING_X * 2,
              height: target.height + FILTERS_RING_Y * 2,
              borderRadius: Radii.pill,
              borderColor: theme.brass,
            },
            ringStyle,
          ]}
        />
        <View style={[styles.arrow, { left: cx - 8, top: arrowTop }]}>
          <Svg width={16} height={ARROW_H} viewBox="0 0 16 30">
            <Path
              d="M8 28V4M2 10l6-7 6 7"
              stroke={theme.brass}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </View>
        <View
          style={[
            styles.bubble,
            {
              left: bubbleLeft,
              top: arrowTop + ARROW_H,
              backgroundColor: theme.surfaceOpaque,
              borderColor: theme.border,
            },
          ]}>
          <ThemedText type="smallBold">{info.title}</ThemedText>
          <ThemedText type="small">{info.text}</ThemedText>
          <ThemedText type="small" style={styles.more}>
            {TOUR_STEPS.length}/{TOUR_STEPS.length} · Toca para empezar
          </ThemedText>
        </View>
      </Animated.View>
    );
  }

  return (
    <View
      ref={rootRef}
      collapsable={false}
      testID="filters-tour"
      style={StyleSheet.absoluteFill}
      pointerEvents="none">
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING,
    borderWidth: 2.5,
  },
  arrow: {
    position: 'absolute',
    width: 16,
    height: ARROW_H,
  },
  bubble: {
    position: 'absolute',
    width: BUBBLE_W,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radii.card,
    borderWidth: Stroke.hairline,
    gap: 2,
  },
  more: {
    opacity: 0.6,
    marginTop: 2,
  },
});
