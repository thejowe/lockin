/**
 * Deck agotado.
 *
 * Quedarse sin tarjetas es un final normal del flujo, no un error: la pantalla
 * dice qué ha pasado, por qué puede estar vacío y qué se puede hacer ahora.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ActionButton } from './action-button';

import type { ModePreference } from '@/data';

export function DeckEmpty({
  mode,
  onOpenMatches,
  onRefresh,
}: {
  /** Modo con el que está filtrado el deck: cambia el motivo del vacío. */
  mode: ModePreference;
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
      <ThemedText type="label" themeColor="brass">
        Deck vacío
      </ThemedText>

      <ThemedText type="title">Ya has visto a todo el mundo</ThemedText>

      <ThemedText type="body" themeColor="textSecondary">
        {mode === 'ambos'
          ? 'No quedan perfiles nuevos por decidir. Vuelve en un rato: la gente que se apunta entra directamente en tu deck.'
          : 'No quedan perfiles nuevos en este modo. Prueba a cambiar el filtro de arriba para ver el resto.'}
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
});
