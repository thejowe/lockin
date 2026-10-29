/**
 * Flecha de volver, arriba a la izquierda de las pantallas de cuenta
 * («Iniciar sesión», «Sobre ti», «Crea tu cuenta»). Sustituye al botón
 * «Volver»/«Atrás» del pie (decisión del usuario del 2026-10-30).
 *
 * Va fuera del scroll, en la esquina de la pantalla: quien la monta la pone
 * dentro del `SafeAreaView`, que ya la separa de la barra de estado.
 */

import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/icon';
import { Control, Opacity, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function BackArrow({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Volver"
      onPress={onPress}
      style={({ pressed }) => [styles.button, { opacity: pressed ? Opacity.pressed : 1 }]}>
      <Icon name="back" size={24} color={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: Control.minTouch,
    height: Control.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.two,
  },
});
