import { Image } from 'expo-image';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { glassStyle } from '@/components/glass';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Control, Opacity, Radii, Spacing } from '@/constants/theme';
import type { ProjectInput } from '@/data';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

/** The project brief uses the original ember accent for the primary action. */
const ember = '#FF8645';

export function ProjectPrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        {
          backgroundColor: disabled ? theme.backgroundElement : ember,
          opacity: pressed ? Opacity.pressed : 1,
        },
      ]}>
      <ThemedText type="bodyStrong" themeColor={disabled ? 'textMuted' : 'onAccent'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function CreateProjectCard({
  onPress,
  prominent = false,
}: {
  onPress: () => void;
  prominent?: boolean;
}) {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const hint = t('Enséñale a la gente lo que has construido');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('Crear proyecto')}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [
        glassStyle(theme, { elevated: pressed }),
        styles.create,
        prominent && { minHeight: Math.max(184, Math.min(360, height * 0.4)) },
      ]}>
      <View
        style={[
          styles.plus,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}>
        <View style={styles.rotate}>
          <Icon name="close" size={28} strokeWidth={1.6} color={theme.text} />
        </View>
      </View>
      <View style={styles.createCopy}>
        <ThemedText type="subtitle" style={styles.center}>
          {t('Crear proyecto')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {hint}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/** Shared by the editor and the saved card so the photo, crop and text line up at landing. */
export function ProjectCover({
  name,
  tagline,
  cover,
  placeholder,
  editable = false,
}: Pick<ProjectInput, 'name' | 'tagline' | 'cover'> & {
  placeholder?: string;
  editable?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[glassStyle(theme), styles.cover, { backgroundColor: theme.surfaceOpaque }]}>
      {cover ? (
        <Image source={{ uri: cover.uri }} contentFit="cover" style={StyleSheet.absoluteFill} />
      ) : null}
      {editable ? (
        <View style={[styles.editMark, { backgroundColor: theme.surfaceOpaque }]}>
          <Icon name="pencil" size={16} color={theme.textSecondary} />
        </View>
      ) : null}
      <View
        style={[
          styles.caption,
          {
            backgroundImage: `linear-gradient(to bottom, transparent, ${theme.background}BD 26%, ${theme.background}E6)`,
          },
        ]}>
        {name || placeholder ? (
          <ThemedText type="subtitle" numberOfLines={2}>
            {name || placeholder}
          </ThemedText>
        ) : null}
        {tagline ? (
          <ThemedText type="small" numberOfLines={2}>
            {tagline}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  primary: {
    minHeight: Control.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radii.pill,
  },
  create: {
    minHeight: 184,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  plus: {
    width: 48,
    height: 48,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  rotate: { transform: [{ rotate: '45deg' }] },
  createCopy: { gap: Spacing.one, alignItems: 'center' },
  center: { textAlign: 'center' },
  cover: { minHeight: 184, overflow: 'hidden', justifyContent: 'flex-end', paddingTop: 54 },
  editMark: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    width: 32,
    height: 32,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    paddingTop: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.one,
  },
});
