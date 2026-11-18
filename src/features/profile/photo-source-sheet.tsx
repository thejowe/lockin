import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { ThemedText } from '@/components/themed-text';
import { Control, Opacity, Radii, Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

import { pickAvatarPhoto } from './avatar-photo';

type Source = 'camera' | 'library';

export async function chooseProfilePhoto(source: Source) {
  const picked = await pickAvatarPhoto(source);
  if (picked.status === 'denied') {
    throw new Error(
      source === 'camera'
        ? t(
            'Sin permiso de cámara no podemos hacerte la foto. Puedes dárselo en los ajustes del móvil.'
          )
        : t(
            'Sin permiso de galería no podemos leer tu foto. Puedes dárselo en los ajustes del móvil.'
          )
    );
  }
  return picked.status === 'picked' ? picked.uri : null;
}

export function PhotoSourceSheet({
  visible,
  onClose,
  onChoose,
  onRemove,
  busy,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  onChoose: (source: Source) => void;
  onRemove?: () => void;
  busy: boolean;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const actions = [
    { label: t('Hacer una foto'), press: () => onChoose('camera') },
    { label: t('Elegir de la galería'), press: () => onChoose('library') },
    ...(onRemove ? [{ label: t('Eliminar foto'), press: onRemove, destructive: true }] : []),
  ];
  return (
    <BottomSheet
      visible={visible}
      title={t('Foto de perfil')}
      onClose={onClose}
      snapPoints={children ? [onRemove ? 392 : 342, '85%'] : [238, '65%']}>
      <View style={styles.content}>
        {children}
        <View style={[styles.list, { backgroundColor: theme.backgroundElement }]}>
          {actions.map((action, index) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => void action.press()}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: pressed ? theme.backgroundSelected : undefined,
                  borderColor: theme.border,
                  borderTopWidth: index ? Stroke.hairline : 0,
                  opacity: busy ? Opacity.disabled : 1,
                },
              ]}>
              <ThemedText type="body" themeColor={'destructive' in action ? 'danger' : 'text'}>
                {action.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.three },
  list: { borderRadius: Radii.medium, overflow: 'hidden' },
  row: {
    minHeight: Control.field,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
