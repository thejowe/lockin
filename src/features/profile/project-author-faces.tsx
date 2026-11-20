import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Project } from '@/data';
import { ProfileAvatar } from '@/features/chat/profile-avatar';
import { joinList, t } from '@/i18n';

export function ProjectAuthorFaces({
  project,
  compact = false,
}: {
  project: Project;
  compact?: boolean;
}) {
  const authors = project.authors ?? [];
  if (authors.length < 2) return null;
  const names = joinList(authors.map((a) => a.name));
  return (
    <View accessible accessibilityLabel={t('Autores: {names}', { names })} style={styles.row}>
      {authors.map((a) => (
        <ProfileAvatar key={a.id} avatar={a.avatar} size={30} />
      ))}
      {!compact && (
        <ThemedText type="smallBold" style={styles.names} numberOfLines={2}>
          {names}
        </ThemedText>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  names: { flexShrink: 1 },
});
