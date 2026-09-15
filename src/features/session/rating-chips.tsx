/**
 * La fila de tres toques de la valoración.
 *
 * No sabe nada de repositorios: recibe `onSelect` y ya. Tres objetivos táctiles
 * de 44 separados por `Spacing.two`, que es lo que hace improbable el toque
 * accidental de algo que no se puede deshacer (spec § 2).
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { RATING_OPTIONS, ratingLabel } from './rating';

import type { SessionRating } from '@/data';

export function RatingChips({
  onSelect,
  selected = null,
  disabled = false,
}: {
  onSelect: (rating: SessionRating) => void;
  /** La ya escrita, si la hay. */
  selected?: SessionRating | null;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {RATING_OPTIONS.map((rating) => {
        const checked = rating === selected;
        const label = ratingLabel(rating);
        return (
          <Pressable
            key={rating}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ checked, disabled }}
            disabled={disabled}
            onPress={() => onSelect(rating)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: checked ? theme.brass : theme.backgroundElement,
                borderColor: theme.border,
                opacity: disabled ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}>
            <ThemedText type="bodyStrong" style={{ color: checked ? theme.onAccent : theme.text }}>
              {label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  chip: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
