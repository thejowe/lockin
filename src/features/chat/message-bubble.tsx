/**
 * Una burbuja de la conversación.
 *
 * El lado se decide con `isMine`, que la pantalla deriva comparando el emisor
 * con el perfil del otro lado del match — nunca con un id de usuario cableado,
 * para que siga funcionando cuando los mensajes vengan del backend real.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { formatClock } from './format';

import type { Message } from '@/data';

export function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  const theme = useTheme();

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
      <View
        style={[
          styles.bubble,
          isMine
            ? { backgroundColor: theme.brass, borderBottomRightRadius: Radii.small }
            : {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
                borderWidth: StyleSheet.hairlineWidth,
                borderBottomLeftRadius: Radii.small,
              },
        ]}>
        <ThemedText type="body" style={isMine ? { color: theme.onAccent } : undefined}>
          {message.body}
        </ThemedText>
        <ThemedText
          type="caption"
          themeColor={isMine ? undefined : 'textMuted'}
          style={[styles.clock, isMine ? { color: theme.onAccent, opacity: 0.75 } : undefined]}>
          {formatClock(message.sentAt)}
        </ThemedText>
      </View>
    </View>
  );
}

/** Separador de día. Aparece antes del primer mensaje de cada jornada. */
export function DayDivider({ label }: { label: string }) {
  return (
    <View style={styles.divider}>
      <ThemedText type="label" themeColor="textMuted">
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
