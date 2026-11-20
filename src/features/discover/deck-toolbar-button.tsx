import type { ComponentRef, Ref } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Control, HitSlop, Opacity, Radii, Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function DeckToolbarButton({
  label,
  icon,
  accessibilityLabel = label,
  onPress,
  disabled,
  buttonRef,
}: {
  label: string;
  icon?: IconName | 'plus';
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  buttonRef?: Ref<ComponentRef<typeof View>>;
}) {
  const theme = useTheme();
  return (
    <Pressable
      ref={buttonRef}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      hitSlop={HitSlop.chip}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          opacity: pressed ? Opacity.pressed : 1,
        },
      ]}>
      {icon === 'plus' ? (
        <ThemedText type="bodyStrong" accessible={false}>
          +
        </ThemedText>
      ) : icon ? (
        <Icon name={icon} size={18} color={theme.text} />
      ) : null}
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    minHeight: Control.minTouch,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    borderWidth: Stroke.hairline,
  },
});
