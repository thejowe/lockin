/**
 * Una burbuja de la conversación.
 *
 * El lado se decide con `isMine`, que la pantalla deriva comparando el emisor
 * con el perfil del otro lado del match — nunca con un id de usuario cableado,
 * para que siga funcionando cuando los mensajes vengan del backend real.
 *
 * Un mensaje recién llegado (enviado hace menos de `FRESH_MS`) entra subiendo
 * y fundiendo: es la confirmación de que ha salido o de que acaba de llegar. El
 * historial que ya estaba al abrir el chat no se anima — veinte burbujas
 * entrando a la vez son ruido, no información. Reanimated apaga la entrada con
 * «reducir movimiento» (`ReduceMotion.System`, su valor por defecto).
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Curves, Duration, Radii, Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { formatClock } from './format';

import type { Message } from '@/data';

/** Antigüedad por debajo de la cual un mensaje cuenta como recién llegado. */
const FRESH_MS = 3_000;

const ENTERING = FadeInDown.duration(Duration.base).easing(Easing.bezier(...Curves.out));

export function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  const theme = useTheme();
  // Se decide una vez, al montar: la burbuja no vuelve a entrar si se repinta.
  const [fresh] = useState(() => Date.now() - Date.parse(message.sentAt) < FRESH_MS);

  return (
    <Animated.View
      entering={fresh ? ENTERING : undefined}
      style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
      <View
        style={[
          styles.bubble,
          isMine
            ? { backgroundColor: theme.brass, borderBottomRightRadius: Radii.small }
            : {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
                borderWidth: Stroke.hairline,
                borderBottomLeftRadius: Radii.small,
                boxShadow: `inset 0px 1px 0px ${theme.glassHighlight}`,
              },
        ]}>
        <ThemedText type="body" style={isMine ? { color: theme.onAccent } : undefined}>
          {message.body}
        </ThemedText>
        <ThemedText
          type="caption"
          themeColor={isMine ? undefined : 'textMuted'}
          // Tinta plena y no atenuada: al 75 % sobre latón la hora bajaba a
          // 3.7:1 con 12 px, por debajo de AA. La jerarquía ya la da el tamaño.
          style={[styles.clock, isMine ? { color: theme.onAccent } : undefined]}>
          {formatClock(message.sentAt)}
        </ThemedText>
      </View>
    </Animated.View>
  );
}

/** Separador de día. Aparece antes del primer mensaje de cada jornada. */
export function DayDivider({ label }: { label: string }) {
  return (
    <View style={styles.divider}>
      <ThemedText type="caption" themeColor="textMuted">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  rowMine: {
    justifyContent: 'flex-end',
  },
  rowTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    // Deja ver que hay otro lado: una burbuja nunca ocupa la línea entera.
    maxWidth: '82%',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.large,
    gap: Spacing.half,
  },
  clock: {
    alignSelf: 'flex-end',
  },
  divider: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
