/**
 * Marcador de pantalla del shell de navegación.
 *
 * ANDAMIO TEMPORAL — existe solo para que las rutas del shell resuelvan
 * mientras los bloques `perfil`, `descubrir` y `chat` construyen sus pantallas.
 * Cuando la última ruta tenga contenido real, borra este componente.
 */

import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ScreenPlaceholder({
  label,
  title,
  description,
  owner,
}: {
  /** Etiqueta corta en versales sobre el título. */
  label: string;
  title: string;
  description: string;
  /** Bloque del roadmap que construirá esta pantalla. */
  owner: string;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="label" themeColor="brass">
          {label}
        </ThemedText>
        <ThemedText type="title">{title}</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          {description}
        </ThemedText>

        <View
          style={[
            styles.note,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          <ThemedText type="mono" themeColor="textMuted">
            Pendiente: bloque `{owner}`
          </ThemedText>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
  },
  note: {
    marginTop: Spacing.two,
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
