/**
 * Deck agotado.
 *
 * Quedarse sin tarjetas es un final normal del flujo, no un error: la pantalla
 * dice qué ha pasado, por qué puede estar vacío y qué se puede hacer ahora.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ActionButton } from './action-button';

export function DeckEmpty({
  onOpenMatches,
  onRefresh,
}: {
  onOpenMatches: () => void;
  onRefresh: () => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      <ThemedText type="label" themeColor="textSecondary">
        Deck vacío
      </ThemedText>

      <ThemedText type="title">Ya has visto a todo el mundo</ThemedText>

      <ThemedText type="body" themeColor="textSecondary">
        No quedan perfiles nuevos por decidir. Vuelve en un rato: la gente que se apunta entra
        directamente en tu deck.
      </ThemedText>

      <View style={styles.actions}>
        <ActionButton label="Ver mis matches" onPress={onOpenMatches} />
        <ActionButton label="Volver a comprobar" variant="secondary" onPress={onRefresh} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radii.card,
    borderWidth: Stroke.hairline,
  },
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
});
