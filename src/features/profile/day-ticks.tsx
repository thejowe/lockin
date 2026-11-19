import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { DAY_TICKS } from '@/data/work-range';

/** Una marca en flujo fija el alto incluso con el tamaño de letra del sistema ampliado. */
export function DayTicks() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {DAY_TICKS.map((hour) => (
        <ThemedText
          key={hour}
          type="mono"
          themeColor="textMuted"
          style={
            hour === 24
              ? styles.end
              : hour === 0
                ? styles.start
                : [styles.middle, { left: `${(hour / 24) * 100}%` }]
          }>
          {String(hour).padStart(2, '0')}
        </ThemedText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  start: { alignSelf: 'flex-start' },
  end: { position: 'absolute', right: 0 },
  middle: { position: 'absolute', transform: [{ translateX: '-50%' }] },
});
