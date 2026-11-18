import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Curves, Duration, Spacing } from '@/constants/theme';

import { arrivalImpact } from './haptics';
import type { Arrivals } from './useArrivals';

const settle = { duration: Duration.base, easing: Easing.bezier(...Curves.out) };
const tap = { duration: Duration.fast, easing: Easing.bezier(...Curves.inOut) };
const fade = { ...tap, reduceMotion: ReduceMotion.Never };

/** The motion wrapper carries the photo's existing (statically tilted) pressable. */
/** Tope de espera a la imagen: una foto que no carga no deja el hueco vacío para siempre. */
export const PIN_WAIT_MS = 3000;

export function PinDrop({
  id,
  arrivals,
  ready: imageReady = true,
  children,
}: {
  id: string;
  arrivals: Arrivals;
  /**
   * La imagen ya se puede pintar. Con Supabase llega por URL firmada después de
   * montar la tarjeta: sin esperar, la caída y la chincheta se veían sobre un
   * papel vacío. Mientras espera, la foto está oculta.
   */
  ready?: boolean;
  children: (pinStyle: AnimatedStyle<ViewStyle>) => ReactNode;
}) {
  const { pending, reduced, claim, finish } = arrivals;
  const playing = useRef<string>(undefined);
  const active = pending.has(id);
  const [timedOut, setTimedOut] = useState(false);
  const ready = imageReady || timedOut;
  useEffect(() => {
    if (!active || ready) return;
    const timer = setTimeout(() => setTimedOut(true), PIN_WAIT_MS);
    return () => clearTimeout(timer);
  }, [active, ready]);
  // -1 = waiting for the image (hidden), 0 = held above the cork, 1 = paper settled, 2 = pin seated.
  const progress = useSharedValue(active ? (ready ? 0 : -1) : 2);
  useLayoutEffect(() => {
    if (!active) {
      progress.set(2);
      return;
    }
    if (!ready) {
      progress.set(-1);
      return;
    }
    if (playing.current !== id && !claim(id)) {
      // The old cell already started this drop before it was recycled.
      progress.set(2);
      finish(id);
      return;
    }
    playing.current = id;
    let live = true;
    const landed = () => {
      if (!live) return;
      live = false;
      finish(id);
      arrivalImpact('pin');
    };
    const onEnd = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(landed);
    };
    progress.set(0);
    progress.set(
      reduced
        ? withTiming(2, fade, onEnd)
        : withSequence(withTiming(1, settle), withTiming(2, tap, onEnd))
    );
    return () => {
      live = false;
      cancelAnimation(progress);
    };
  }, [active, ready, claim, finish, id, progress, reduced]);

  const photo = useAnimatedStyle(() => {
    const p = progress.get();
    if (p < 0) return { opacity: 0, transform: [] };
    if (reduced) return { opacity: p / 2, transform: [] };
    const fall = Math.min(p, 1);
    // A single 2 dp overshoot; the pin only starts moving after it settles.
    const y =
      fall < 0.8
        ? -Spacing.four + ((Spacing.four + Spacing.half) * fall) / 0.8
        : (Spacing.half * (1 - fall)) / 0.2;
    return {
      opacity: 1,
      transform: [
        { translateY: y },
        { scale: 1 + 0.045 * (1 - fall) },
        { rotate: `${2 * (1 - fall)}deg` },
      ],
    };
  });
  const pin = useAnimatedStyle(() => {
    const p = progress.get();
    if (reduced) return { opacity: 1, transform: [] };
    const strike = Math.max(0, p - 1);
    return {
      opacity: Math.min(1, strike * 2),
      transform: [{ translateY: -Spacing.two * (1 - strike) }, { scale: 1 + 0.08 * (1 - strike) }],
    };
  });
  return <Animated.View style={[styles.photo, photo]}>{children(pin)}</Animated.View>;
}

const styles = StyleSheet.create({ photo: { flex: 1 } });
