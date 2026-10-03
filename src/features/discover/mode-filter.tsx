/**
 * Filtro de modo del deck: Todo / Cofundador / Lock-In.
 *
 * Control segmentado de cristal, como los de iOS: tres segmentos iguales y una
 * pastilla que se desliza con un muelle hasta el elegido. El ojo sigue una sola
 * pieza en movimiento en vez de ver dos chips que se apagan y se encienden. Con
 * «reducir movimiento» la pastilla salta sin recorrido.
 *
 * Accesibilidad: es un `radiogroup` de tres `radio`, y cada uno se anuncia con
 * el nombre completo del modo (`modeLabel`), no con la etiqueta corta.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withSpring } from 'react-native-reanimated';

import { glassStyle } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { Opacity, Radii, Springs } from '@/constants/theme';
import { modeLabel } from '@/features/profile';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

import type { ModePreference } from '@/data';

const FILTERS: { value: ModePreference; short: string }[] = [
  { value: 'ambos', short: 'Todo' },
  { value: 'par', short: 'Cofundador' },
  { value: 'lockin', short: 'Lock-In' },
];

/** Hueco entre el canto del control y la pastilla. */
const INSET = 3;
/** Alto de cada segmento: 44 táctiles sin `hitSlop`. */
const SEGMENT_HEIGHT = 44;

export function ModeFilter({
  value,
  onChange,
}: {
  value: ModePreference;
  onChange: (mode: ModePreference) => void;
}) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);

  const index = Math.max(
    0,
    FILTERS.findIndex((filter) => filter.value === value)
  );
  const segment = width > 0 ? (width - INSET * 2) / FILTERS.length : 0;

  const x = useDerivedValue(() =>
    reduceMotion ? index * segment : withSpring(index * segment, Springs.glide)
  );
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View
      accessibilityRole="radiogroup"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.track, glassStyle(theme, { radius: Radii.pill })]}>
      {segment > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              width: segment,
              backgroundColor: theme.backgroundSelected,
              boxShadow: `inset 0px 1px 0px ${theme.glassHighlight}, 0px 2px 8px rgba(0, 0, 0, 0.25)`,
            },
            thumb,
          ]}
        />
      ) : null}

      {FILTERS.map((filter) => {
        const selected = filter.value === value;

        return (
          <Pressable
            key={filter.value}
            accessibilityRole="radio"
            accessibilityLabel={modeLabel(filter.value)}
            accessibilityState={{ selected }}
            onPress={() => onChange(filter.value)}
            style={({ pressed }) => [styles.segment, pressed && styles.pressed]}>
            <ThemedText type="smallBold" themeColor={selected ? 'text' : 'textSecondary'}>
              {filter.short}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: INSET,
  },
  thumb: {
    position: 'absolute',
    top: INSET,
    left: INSET,
    height: SEGMENT_HEIGHT,
    borderRadius: Radii.pill,
  },
  segment: {
    flex: 1,
    height: SEGMENT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.pill,
  },
  pressed: {
    opacity: Opacity.pressed,
  },
});
