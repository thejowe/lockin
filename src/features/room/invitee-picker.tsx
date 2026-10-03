/**
 * Con quién: tus matches como chips de selección múltiple, con su avatar.
 *
 * Al llegar al tope (`ROOM_MAX_INVITEES`) los no marcados se deshabilitan en vez
 * de rechazar el toque en silencio: así se ve por qué no entra el quinto.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { glassStyle } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { Control, Opacity, Radii, Spacing } from '@/constants/theme';
import { ROOM_MAX_INVITEES } from '@/data';
import { ProfileAvatar } from '@/features/chat';
import { useTheme } from '@/hooks/use-theme';

import type { MatchWithProfile } from '@/data';

export function InviteePicker({
  matches,
  selected,
  onToggle,
}: {
  matches: MatchWithProfile[];
  /** Ids de perfil marcados. */
  selected: ReadonlySet<string>;
  onToggle(profileId: string): void;
}) {
  const theme = useTheme();
  const full = selected.size >= ROOM_MAX_INVITEES;

  return (
    <View style={styles.root}>
      <ThemedText type="small" themeColor="textSecondary">
        {`${selected.size} de ${ROOM_MAX_INVITEES}`}
      </ThemedText>
      <View style={styles.chips}>
        {matches.map(({ id, counterpart }) => {
          const checked = selected.has(counterpart.id);
          const disabled = !checked && full;
          return (
            <Pressable
              key={id}
              accessibilityRole="checkbox"
              accessibilityLabel={counterpart.name}
              accessibilityState={{ checked, disabled }}
              disabled={disabled}
              onPress={() => onToggle(counterpart.id)}
              style={[
                styles.chip,
                glassStyle(theme, { elevated: checked, radius: Radii.pill }),
                checked && { borderColor: theme.teal, backgroundColor: theme.tealSoft },
                disabled && { opacity: Opacity.disabled },
              ]}>
              <ProfileAvatar avatar={counterpart.avatar} size={28} />
              <ThemedText type="smallBold" themeColor={checked ? 'teal' : 'text'}>
                {counterpart.name.split(' ')[0]}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: Control.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    paddingLeft: Spacing.one,
    paddingRight: Spacing.three,
  },
});
