import { Pressable, StyleSheet, View } from 'react-native';

import { glassStyle } from '@/components/glass';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Control, Spacing } from '@/constants/theme';
import { useNow } from '@/features/session/use-now';
import { useTheme } from '@/hooks/use-theme';

import { roomRowView } from './row-view';

import type { RoomView } from '@/data';

/** La navegación pertenece a la sección que compone la lista de salas. */
export function RoomRow({ view, onPress }: { view: RoomView; onPress: () => void }) {
  const theme = useTheme();
  const nowMs = useNow(30_000);
  const { title, detail, accent } = roomRowView(view, nowMs);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} · ${detail}`}
      onPress={onPress}
      style={({ pressed }) => [styles.root, glassStyle(theme, { elevated: pressed })]}>
      <Icon name="focus" color={accent ? theme[accent] : theme.teal} />
      <View style={styles.body}>
        <ThemedText type="heading" themeColor={accent ?? 'text'}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {detail}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: Control.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  body: { flex: 1, gap: Spacing.one },
});
