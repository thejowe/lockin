/**
 * La fila del chat del grupo en Matches: mientras estás en un grupo, su
 * conversación vive junto a las de tus matches. Sin grupo no pinta nada.
 */

import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

import { useMyGroup } from './use-my-group';

export function GroupChatRow() {
  const theme = useTheme();
  const { group: view } = useMyGroup();
  if (!view) return null;

  return (
    <Link href={`/group/${view.group.id}` as Href} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Chat del grupo {name}', { name: view.group.name })}>
        {({ pressed }) => (
          <View
            collapsable={false}
            style={[
              styles.root,
              {
                backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
                borderColor: theme.border,
              },
            ]}>
            <View style={styles.body}>
              <ThemedText type="heading" numberOfLines={1}>
                {view.group.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {t('Chat de grupo · {count} miembros', { count: view.members.length })}
              </ThemedText>
            </View>
            <ThemedText type="label" themeColor="teal">
              {t('Grupo')}
            </ThemedText>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radii.large,
    borderWidth: Stroke.hairline,
  },
  body: { flex: 1, gap: Spacing.half },
});
