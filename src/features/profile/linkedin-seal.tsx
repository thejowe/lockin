/**
 * El sello de LinkedIn verificado. Mismas reglas que `GithubSeal`: nunca solo
 * un icono, y el copy nombra LinkedIn. LinkedIn (OpenID Connect) no da la URL
 * del perfil, así que certifica que la cuenta con ese nombre es de quien tiene
 * la ficha, y nada más.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function LinkedinSeal({ name, compact = false }: { name: string; compact?: boolean }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`LinkedIn verificado: ${name}`}
      style={[
        styles.seal,
        compact ? styles.compact : styles.full,
        { backgroundColor: theme.brassSoft },
      ]}>
      <ThemedText type={compact ? 'smallBold' : 'bodyStrong'} themeColor="brass">
        {compact ? '✓ LinkedIn' : `✓ LinkedIn · ${name}`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  seal: {
    alignSelf: 'flex-start',
    borderRadius: Radii.pill,
  },
  full: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  compact: {
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
});
