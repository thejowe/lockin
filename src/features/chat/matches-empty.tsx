/**
 * Estado vacío de la lista de matches.
 *
 * Es la pantalla que más gente verá el primer día, así que no se limita a decir
 * que no hay nada: explica de dónde salen los matches y ofrece el camino.
 */

import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export function MatchesEmpty() {
  return (
    <View style={styles.root}>
      <ThemedText type="subtitle" style={styles.centered}>
        Todavía no hay nadie al otro lado
      </ThemedText>

      <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
        Un match aparece aquí cuando dos personas se dan like. Sigue pasando tarjetas en Descubrir y
        en cuanto haya reciprocidad tendrás con quién hablar.
      </ThemedText>

      <Button label="Ir a Descubrir" href="/discover" style={styles.action} />
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
    alignSelf: 'stretch',
    marginTop: Spacing.two,
  },
});
