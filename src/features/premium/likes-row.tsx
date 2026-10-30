/**
 * La fila «Te han dado like (N)» de Matches.
 *
 * Solo el número y la puerta a la cuadrícula: quién te ha dado like es de
 * Premium, pero cuánta gente lo ha hecho lo ve cualquiera. Sin likes no se pinta.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function LikesRow({ count, onPress }: { count: number; onPress: () => void }) {
  const theme = useTheme();
  if (count <= 0) return null;

  const label = `Te han dado like (${count})`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.root,
        {
          backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: theme.border,
        },
      ]}>
      <View style={[styles.icon, { backgroundColor: theme.brassSoft }]}>
        <Icon name="heart" size={18} color={theme.brass} />
      </View>
      <ThemedText type="heading" style={styles.label}>
        {label}
      </ThemedText>
      <Icon name="chevrons" size={18} color={theme.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderRadius: Radii.large,
    borderWidth: Stroke.hairline,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
  },
});
