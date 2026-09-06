/** Etiqueta compacta de dato (especialidad, modo, disponibilidad). */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Neutro para datos; latón para la acción/marca; verde-azulado para el modo. */
export type ChipTone = 'neutral' | 'brass' | 'teal';

export function Chip({ label, tone = 'neutral' }: { label: string; tone?: ChipTone }) {
  const theme = useTheme();

  const background =
    tone === 'brass'
      ? theme.brassSoft
      : tone === 'teal'
        ? theme.tealSoft
        : theme.backgroundSelected;
  const color = tone === 'brass' ? theme.brass : tone === 'teal' ? theme.teal : theme.textSecondary;

  return (
    <View style={[styles.chip, { backgroundColor: background }]}>
      <ThemedText type="label" style={{ color }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.pill,
  },
});
