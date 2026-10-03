/** Etiqueta compacta de dato (especialidad, modo, disponibilidad). */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { ThemePalette } from '@/constants/theme';

/**
 * Neutro para datos; verde-azulado para lo que la persona domina; latón para lo
 * que busca; latón sólido (`match`) para lo que busca y quien mira ya domina.
 *
 * El par domina/busca usa los mismos dos acentos que la ficha larga
 * (`ProfileDetails`): una tarjeta y una ficha del mismo perfil no pueden
 * enseñar el mismo dato en colores distintos.
 */
export type ChipTone = 'neutral' | 'brass' | 'teal' | 'match';

/** El tono relleno se distingue por color, así que el texto lleva además "✓". */
function palette(theme: ThemePalette, tone: ChipTone) {
  switch (tone) {
    case 'brass':
      return { background: theme.brassSoft, color: theme.brass };
    case 'teal':
      return { background: theme.tealSoft, color: theme.teal };
    case 'match':
      return { background: theme.brass, color: theme.onAccent };
    default:
      return { background: theme.backgroundSelected, color: theme.text };
  }
}

export function Chip({ label, tone = 'neutral' }: { label: string; tone?: ChipTone }) {
  const theme = useTheme();
  const { background, color } = palette(theme, tone);

  return (
    <View style={[styles.chip, { backgroundColor: background }]}>
      <ThemedText type="smallBold" style={{ color }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two + Spacing.half,
    borderRadius: Radii.pill,
  },
});
