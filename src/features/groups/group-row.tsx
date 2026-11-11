/**
 * Las filas de los chats de grupo en Matches: una por cada grupo en el que
 * estás, junto a las conversaciones de tus matches. Sin grupos no pinta nada.
 */

import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

import { useMyGroups } from './use-my-group';

import type { GroupView } from '@/data';

export function GroupChatRows() {
  const { groups } = useMyGroups();
  return (
    <>
      {groups.map((view) => (
        <GroupChatRow key={view.group.id} view={view} />
      ))}
    </>
  );
}

function GroupChatRow({ view }: { view: GroupView }) {
  const theme = useTheme();

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
