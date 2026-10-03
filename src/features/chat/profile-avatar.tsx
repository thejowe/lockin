/**
 * Avatar por iniciales.
 *
 * El MVP no sube imágenes (ver `CONCEPTO.md`): el avatar son 1-2 letras sobre el
 * acento que trae el propio perfil, así que dos personas distintas nunca se ven
 * iguales en una lista.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { Avatar } from '@/data';

/** Alfa del tinte: deja leer las iniciales claras encima (≥ 4.5:1). */
const TINT_ALPHA = '8C';

export function ProfileAvatar({ avatar, size = 48 }: { avatar: Avatar; size?: number }) {
  const theme = useTheme();
  const accent = avatar.accent === 'teal' ? theme.teal : theme.brass;

  return (
    <View
      accessible={false}
      style={[
        styles.root,
        {
          width: size,
          height: size,
          borderRadius: Radii.pill,
          // Vidrio teñido del color de la persona (el mismo material que el
          // avatar de perfil), con iniciales claras encima.
          backgroundColor: accent + TINT_ALPHA,
          borderColor: theme.border,
          boxShadow: `inset 0px 1px 0px ${theme.glassHighlight}`,
        },
      ]}>
      <ThemedText
        type="smallBold"
        // El tamaño escala con el círculo: el mismo componente sirve para la
        // fila de la lista y para la cabecera de la conversación.
        style={[styles.initials, { fontSize: size * 0.34, lineHeight: size * 0.4 }]}>
        {avatar.initials}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: Stroke.hairline,
  },
  initials: {
    letterSpacing: 0,
  },
});
