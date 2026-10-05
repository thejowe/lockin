/** Etiqueta compacta de dato (especialidad, modo, disponibilidad). */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { ThemePalette } from '@/constants/theme';

/**
 * La forma dice qué es el dato, no el color:
 * - `have`: lo que la persona domina — relleno, porque lo tiene.
 * - `seek`: lo que busca — solo contorno, porque es un hueco por llenar.
 * - `match`: lo que busca y quien mira ya domina — tinta de brasa sobre su
 *   relleno tenue, con "✓" en el texto para no depender del color.
 * - `neutral`: cualquier otro dato.
 *
 * El par relleno/hueco es el mismo en la ficha larga (`ProfileDetails`): una
 * tarjeta y una ficha del mismo perfil no pueden enseñar el mismo dato distinto.
 */
export type ChipTone = 'neutral' | 'have' | 'seek' | 'match';

function palette(theme: ThemePalette, tone: ChipTone) {
  switch (tone) {
    case 'seek':
      return { background: 'transparent', border: theme.border, color: theme.text };
    case 'match':
      // Señal, no botón: el sólido se reserva para la acción principal.
      return { background: theme.brassSoft, border: 'transparent', color: theme.brass };
    case 'have':
    default:
      return { background: theme.backgroundSelected, border: 'transparent', color: theme.text };
  }
}

export function Chip({ label, tone = 'neutral' }: { label: string; tone?: ChipTone }) {
  const theme = useTheme();
  const { background, border, color } = palette(theme, tone);

  return (
    <View style={[styles.chip, { backgroundColor: background, borderColor: border }]}>
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
    // Todos llevan el trazo (transparente si no toca) para medir igual.
    borderWidth: Stroke.thin,
  },
});
