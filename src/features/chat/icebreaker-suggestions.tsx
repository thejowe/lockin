/**
 * Las aperturas sugeridas que se ven al abrir un chat sin mensajes.
 *
 * Al pulsar una NO se envía: se escribe en el campo para que se pueda editar
 * antes de mandarla. Un match no se rompe por un primer mensaje flojo, pero sí
 * por uno que suene a plantilla enviada sin mirar.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function IcebreakerSuggestions({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  /** Recibe la frase elegida para volcarla en el campo de texto. */
  onPick: (text: string) => void;
}) {
  const theme = useTheme();

  if (suggestions.length === 0) return null;

  return (
    <View style={styles.root}>
      <ThemedText type="label" themeColor="textMuted">
        Para romper el hielo
      </ThemedText>

      {suggestions.map((suggestion) => (
        <Pressable
          key={suggestion}
          accessibilityRole="button"
          accessibilityHint="Escribe esta frase en el campo de mensaje para que puedas editarla"
          onPress={() => onPick(suggestion)}
          style={({ pressed }) => [
            styles.chip,
            {
              backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}>
          <ThemedText type="small">{suggestion}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.large,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
