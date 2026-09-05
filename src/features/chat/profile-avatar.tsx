/**
 * Avatar por iniciales.
 *
 * El MVP no sube imágenes (ver `CONCEPTO.md`): el avatar son 1-2 letras sobre el
 * acento que trae el propio perfil, así que dos personas distintas nunca se ven
 * iguales en una lista.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { Avatar } from '@/data';

export function ProfileAvatar({ avatar, size = 48 }: { avatar: Avatar; size?: number }) {
  const theme = useTheme();
  const accent = avatar.accent === 'teal' ? theme.teal : theme.brass;
  const soft = avatar.accent === 'teal' ? theme.tealSoft : theme.brassSoft;

  return (
    <View
      accessible={false}
      style={[
        styles.root,
        {
          width: size,
          height: size,
          borderRadius: Radii.pill,
          backgroundColor: soft,
          borderColor: accent,
        },
      ]}>
      <ThemedText
        type="label"
        // El tamaño escala con el círculo: el mismo componente sirve para la
        // fila de la lista y para la cabecera de la conversación.
        style={[styles.initials, { color: accent, fontSize: size * 0.34, lineHeight: size * 0.4 }]}>
        {avatar.initials}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  initials: {
    letterSpacing: 0.5,
  },
});
