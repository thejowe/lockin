/**
 * Avatar del MVP: iniciales sobre un acento de marca.
 *
 * No hay subida de imágenes en el MVP (ver `CONCEPTO.md`), así que el avatar se
 * deriva del perfil. Vive aquí porque `perfil` es el dueño de la ficha, pero es
 * reutilizable desde `descubrir` y `chat` sin arrastrar nada más.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { Avatar } from '@/data';

const SIZES = {
  small: { box: 40, type: 'smallBold' },
  medium: { box: 56, type: 'heading' },
  large: { box: 88, type: 'title' },
} as const;

export function ProfileAvatar({
  avatar,
  size = 'medium',
}: {
  avatar: Avatar;
  size?: keyof typeof SIZES;
}) {
  const theme = useTheme();
  const { box, type } = SIZES[size];

  return (
    <View
      // Las iniciales ya salen en el nombre contiguo: no las repitas al lector de pantalla.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.root,
        {
          width: box,
          height: box,
          borderRadius: Radii.pill,
          backgroundColor: avatar.accent === 'teal' ? theme.teal : theme.brass,
        },
      ]}>
      <ThemedText type={type} themeColor="onAccent">
        {avatar.initials}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
