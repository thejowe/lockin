/**
 * "Agendar sesión Lock-In" — el hueco del diferenciador del producto.
 *
 * En el MVP NO agenda nada: no hay vídeo, ni pomodoro compartido, ni calendario
 * (todo eso es Fase 2, ver "Fuera de alcance" en `docs/plan/CONCEPTO.md`). Está
 * aquí a propósito y no se puede quitar: las sesiones de Lock-In son la
 * respuesta al problema de graduación —que la gente abandone la app en cuanto
 * hace match— y rediseñar el chat después para meterlas costaría más que
 * reservarles el sitio ahora.
 *
 * Al pulsar despliega qué será, en vez de fingir una funcionalidad que no
 * existe: promete menos y no rompe la confianza del que lo prueba.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function LockInCta({ counterpartName }: { counterpartName: string }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.root, { backgroundColor: theme.tealSoft, borderColor: theme.teal }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel="Agendar sesión Lock-In"
        accessibilityHint="Todavía no disponible. Ábrelo para saber en qué consistirá."
        onPress={() => setExpanded((value) => !value)}
        style={styles.header}>
        <View style={styles.headerText}>
          <ThemedText type="label" themeColor="teal">
            Sesión Lock-In
          </ThemedText>
          <ThemedText type="bodyStrong">Agendar sesión Lock-In</ThemedText>
        </View>

        <View style={[styles.badge, { borderColor: theme.teal }]}>
          <ThemedText type="label" themeColor="teal">
            {expanded ? 'Cerrar' : 'Pronto'}
          </ThemedText>
        </View>
      </Pressable>

      {expanded && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          Sentaros a trabajar a la vez, cada uno en lo suyo, a una hora acordada. Todavía no está
          construido: de momento acordadlo por aquí con {counterpartName} y ponedlo en vuestro
          calendario.
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: Radii.large,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  headerText: {
    flexShrink: 1,
    gap: Spacing.half,
  },
  badge: {
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  note: {
    paddingBottom: Spacing.two,
  },
});
