/**
 * Avatar del MVP: iniciales sobre un acento de marca.
 *
 * No hay subida de imágenes en el MVP (ver `CONCEPTO.md`), así que el avatar se
 * deriva del perfil. Vive aquí porque `perfil` es el dueño de la ficha, pero es
 * reutilizable desde `descubrir` y `chat` sin arrastrar nada más.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { Avatar } from '@/data';

/** Alfa del tinte del avatar: deja leer las iniciales claras encima (≥ 4.5:1). */
const TINT_ALPHA = '8C';

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
          // Vidrio teñido del color de la persona, con el canto de luz del
          // cristal: el avatar es una pieza más del material, no una pegatina.
          backgroundColor: (avatar.accent === 'teal' ? theme.teal : theme.brass) + TINT_ALPHA,
          borderWidth: Stroke.hairline,
          borderColor: theme.border,
          boxShadow: `inset 0px 1px 0px ${theme.glassHighlight}`,
        },
      ]}>
      <ThemedText type={type}>{avatar.initials}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
