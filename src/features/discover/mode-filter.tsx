/**
 * Filtro de modo sobre el deck.
 *
 * Arranca en el modo que el usuario eligió en el onboarding, pero se puede
 * cambiar sin salir de la pantalla: alguien que se apuntó como "Ambos" querrá
 * separar las dos búsquedas según el día.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { modeLabel } from '@/features/profile';
import { useTheme } from '@/hooks/use-theme';

import type { ModePreference } from '@/data';

/**
 * Etiquetas cortas: las del catálogo de `perfil` ("Compañero de Lock-In") son
 * frases de formulario y no caben en una fila de chips. El nombre completo va
 * en la etiqueta de accesibilidad, que es donde importa que sea explícito.
 */
const FILTERS: { value: ModePreference; short: string }[] = [
  { value: 'ambos', short: 'Todo' },
  { value: 'par', short: 'Cofundador' },
  { value: 'lockin', short: 'Lock-In' },
];

export function ModeFilter({
  value,
  onChange,
}: {
  value: ModePreference;
  onChange: (mode: ModePreference) => void;
}) {
  const theme = useTheme();

  return (
    <View accessibilityRole="radiogroup" style={styles.row}>
      {FILTERS.map((filter) => {
        const selected = filter.value === value;

        return (
          <Pressable
            key={filter.value}
            accessibilityRole="radio"
            accessibilityLabel={modeLabel(filter.value)}
            accessibilityState={{ selected }}
            // El chip mide 32 px de alto: el hitSlop lo lleva a los 44 mínimos
            // sin cambiar cómo se ve la fila de filtros.
            hitSlop={{ top: 6, bottom: 6 }}
            onPress={() => onChange(filter.value)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: selected ? theme.brassSoft : theme.backgroundElement,
                borderColor: selected ? theme.brass : theme.border,
              },
              pressed && styles.chipPressed,
            ]}>
            <ThemedText type="label" themeColor={selected ? 'brass' : 'textSecondary'}>
              {filter.short}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipPressed: {
    opacity: 0.7,
  },
});
