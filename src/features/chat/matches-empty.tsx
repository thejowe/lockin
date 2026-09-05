/**
 * Estado vacío de la lista de matches.
 *
 * Es la pantalla que más gente verá el primer día, así que no se limita a decir
 * que no hay nada: explica de dónde salen los matches y ofrece el camino.
 */

import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function MatchesEmpty() {
  const theme = useTheme();

  return (
    <View style={styles.root}>
      <ThemedText type="subtitle" style={styles.centered}>
        Todavía no hay nadie al otro lado
      </ThemedText>

      <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
        Un match aparece aquí cuando dos personas se dan like. Sigue pasando tarjetas en Descubrir
        y en cuanto haya reciprocidad tendrás con quién hablar.
      </ThemedText>

      <Link href="/discover" asChild>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: theme.brass, opacity: pressed ? 0.85 : 1 },
          ]}>
          <ThemedText type="bodyStrong" style={{ color: theme.onAccent }}>
            Ir a Descubrir
          </ThemedText>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.six,
  },
  centered: {
    textAlign: 'center',
  },
  action: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.pill,
  },
});
