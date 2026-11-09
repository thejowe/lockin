/**
 * La fila «Te han dado like (N)» de Matches.
 *
 * Solo el número y la puerta a la cuadrícula: quién te ha dado like es de
 * Premium, pero cuánta gente lo ha hecho lo ve cualquiera. Sin likes no se pinta.
 */

import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ScalePressable } from '@/components/scale-pressable';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

export function LikesRow({ count, onPress }: { count: number; onPress: () => void }) {
  const theme = useTheme();
  if (count <= 0) return null;

  const label = t('Te han dado like ({count})', { count });

  return (
    <ScalePressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.root, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
      pressedStyle={{ backgroundColor: theme.backgroundSelected }}>
      <View style={[styles.icon, { backgroundColor: theme.brassSoft }]}>
        <Icon name="heart" size={18} color={theme.brass} />
      </View>
      <ThemedText type="heading" style={styles.label}>
        {label}
      </ThemedText>
      <Icon name="chevrons" size={18} color={theme.textMuted} />
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    marginTop: Spacing.three,
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
