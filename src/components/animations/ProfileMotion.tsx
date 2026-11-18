import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Curves, Duration, Opacity, PressScale, Spacing, Springs } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const fade = { duration: Duration.fast, reduceMotion: ReduceMotion.Never };
const slide = { duration: Duration.base, easing: Easing.bezier(...Curves.out) };

/** Drop-in Pressable: retain the parent layout, hit area, refs, testID and a11y props. */
export function SlotPressable({
  style,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  ...props
}: PressableProps) {
  const reduced = useReduceMotion();
  const amount = useSharedValue(0);
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  function press(down: boolean) {
    setPressed(down);
    const next = down ? 1 : 0;
    amount.set(reduced ? withTiming(next, fade) : withSpring(next, Springs.press));
  }
  const feedback = useAnimatedStyle(() =>
    reduced
      ? { opacity: 1 - (1 - Opacity.pressed) * amount.get(), transform: [] }
      : { transform: [{ scale: 1 - (1 - PressScale) * amount.get() }] }
  );
  return (
    <AnimatedPressable
      {...props}
      style={[typeof style === 'function' ? style({ pressed, hovered }) : style, feedback]}
      onHoverIn={(event) => {
        setHovered(true);
        onHoverIn?.(event);
      }}
      onHoverOut={(event) => {
        setHovered(false);
        onHoverOut?.(event);
      }}
      onPressIn={(event) => {
        press(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        press(false);
        onPressOut?.(event);
      }}
    />
  );
}

/** id is the id of the insertion that just displaced the create card. */
export function CreateProjectShift({ id, children }: { id?: string; children: ReactNode }) {
  const reduced = useReduceMotion();
  const progress = useSharedValue(id ? 0 : 1);
  const last = useRef<string>(undefined);
  useLayoutEffect(() => {
    if (!id || last.current === id) return;
    last.current = id;
    progress.set(0);
    progress.set(withTiming(1, reduced ? fade : slide));
  }, [id, progress, reduced]);
  const style = useAnimatedStyle(() =>
    reduced
      ? { opacity: Opacity.pressed + (1 - Opacity.pressed) * progress.get(), transform: [] }
      : { opacity: 1, transform: [{ translateY: -Spacing.two * (1 - progress.get()) }] }
  );
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Wrap the editor's left-pointing "back" icon. Both resting angles match the existing row. */
export function DetailsChevron({ expanded, children }: { expanded: boolean; children: ReactNode }) {
  const reduced = useReduceMotion();
  const angle = useSharedValue(expanded ? 90 : -90);
  const opacity = useSharedValue(1);
  const previous = useRef(expanded);
  useLayoutEffect(() => {
    const changed = expanded !== previous.current;
    previous.current = expanded;
    const target = expanded ? 90 : -90;
    if (reduced) {
      angle.set(target);
      if (changed) {
        opacity.set(0);
        opacity.set(withTiming(1, fade));
      }
    } else if (changed) {
      angle.set(withTiming(target, slide));
    }
  }, [angle, expanded, opacity, reduced]);
  const style = useAnimatedStyle(() => ({
    opacity: reduced ? opacity.get() : 1,
    transform: [{ rotate: `${reduced ? (expanded ? 90 : -90) : angle.get()}deg` }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
