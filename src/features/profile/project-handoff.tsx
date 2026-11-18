import * as Haptics from 'expo-haptics';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewInstance } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Curves, Duration, Radii } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

export type WindowRect = { x: number; y: number; width: number; height: number };
type Travel = { dx: number; dy: number; scaleX: number; scaleY: number };

function validRect(rect?: WindowRect | null): rect is WindowRect {
  return (
    !!rect &&
    [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function measureTravel(source: WindowRect | null, target: ViewInstance | null): Travel | null {
  let rect: WindowRect | undefined;
  try {
    rect = target?.getBoundingClientRect?.();
  } catch {
    // El nativo puede haber desconectado la superficie al cerrar el modal.
    return null;
  }
  if (!validRect(source) || !validRect(rect)) return null;
  return {
    dx: source.x - rect.x + (source.width - rect.width) / 2,
    dy: source.y - rect.y + (source.height - rect.height) / 2,
    scaleX: source.width / rect.width,
    scaleY: source.height / rect.height,
  };
}

function tapOnLanding() {
  const feedback =
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  void feedback.catch(() => {});
}

/** El hueco tiene su tamaño definitivo desde el primer frame. Solo se transforma lo que se dibuja. */
export function ProjectHandoff({
  source,
  onLand,
  children,
}: {
  source: WindowRect | null;
  onLand: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const liveReduced = useReduceMotion();
  const initiallyReduced = useReducedMotion();
  const reduceMotion = liveReduced || initiallyReduced;
  const target = useRef<ViewInstance>(null);
  const travel = useSharedValue<Travel | null>(null);
  const progress = useSharedValue(0);
  const landed = useRef(false);
  const onLandRef = useRef(onLand);
  useLayoutEffect(() => {
    onLandRef.current = onLand;
  }, [onLand]);

  useLayoutEffect(() => {
    if (landed.current) return;
    let mounted = true;
    const land = () => {
      if (!mounted || landed.current) return;
      landed.current = true;
      tapOnLanding();
      onLandRef.current();
    };
    const animate = (path: Travel | null) => {
      travel.set(path);
      progress.set(
        withTiming(
          1,
          {
            duration: path ? Duration.slow : Duration.fast,
            easing: Easing.bezier(...Curves.out),
            // El fundido elegido al reducir movimiento sigue siendo visible.
            reduceMotion: path ? ReduceMotion.System : ReduceMotion.Never,
          },
          (finished) => {
            if (finished) scheduleOnRN(land);
          }
        )
      );
    };
    let frame: number | undefined;
    if (reduceMotion || !source) {
      animate(null);
    } else {
      const path = measureTravel(source, target.current);
      if (path) animate(path);
      // Tras cerrar un modal, Fabric puede devolver una caja vacía durante el primer layout.
      else frame = requestAnimationFrame(() => animate(measureTravel(source, target.current)));
    }
    return () => {
      mounted = false;
      if (frame !== undefined) cancelAnimationFrame(frame);
      cancelAnimation(progress);
    };
  }, [source, reduceMotion, travel, progress]);

  const position = useAnimatedStyle(() => {
    const path = travel.get();
    if (!path || reduceMotion) return { transform: [] };
    const remaining = 1 - progress.get();
    return {
      transform: [{ translateX: path.dx * remaining }, { translateY: path.dy * remaining }],
    };
  });
  // Solo cambia de proporción la superficie lisa. La foto y las letras mantienen la suya.
  const surface = useAnimatedStyle(() => {
    const path = travel.get();
    if (!path || reduceMotion) return { opacity: 0 };
    const remaining = 1 - progress.get();
    return {
      opacity: Math.min(1, remaining * 3),
      transform: [
        { scaleX: 1 + (path.scaleX - 1) * remaining },
        { scaleY: 1 + (path.scaleY - 1) * remaining },
      ],
    };
  });
  const dissolve = useAnimatedStyle(() => ({ opacity: progress.get() }));

  return (
    <View ref={target} collapsable={false}>
      <Animated.View style={position}>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme.surfaceOpaque,
              borderColor: theme.border,
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: Radii.card,
            },
            surface,
          ]}
        />
        <Animated.View style={dissolve}>{children}</Animated.View>
      </Animated.View>
    </View>
  );
}
