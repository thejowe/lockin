/**
 * Las aperturas sugeridas que se ven al abrir un chat sin mensajes.
 *
 * Al pulsar una NO se envía: se escribe en el campo para que se pueda editar
 * antes de mandarla. Un match no se rompe por un primer mensaje flojo, pero sí
 * por uno que suene a plantilla enviada sin mirar.
 */

import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { enterUp } from '@/components/motion';
import { ScalePressable } from '@/components/scale-pressable';
import { ThemedText } from '@/components/themed-text';
import { HitSlop, Radii, Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

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
        {t('Para romper el hielo')}
      </ThemedText>

      {suggestions.map((suggestion, index) => (
        <Animated.View key={suggestion} entering={enterUp(index)}>
          <ScalePressable
            accessibilityRole="button"
            accessibilityHint={t(
              'Escribe esta frase en el campo de mensaje para que puedas editarla'
            )}
            // Una sugerencia de una línea mide 36 px: el hitSlop la lleva por encima de los 44
            // mínimos sin separar las sugerencias entre sí.
            hitSlop={HitSlop.chip}
            onPress={() => onPick(suggestion)}
            style={[
              styles.chip,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
            pressedStyle={{ backgroundColor: theme.backgroundSelected }}>
            <ThemedText type="small">{suggestion}</ThemedText>
          </ScalePressable>
        </Animated.View>
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
    borderWidth: Stroke.hairline,
  },
});
