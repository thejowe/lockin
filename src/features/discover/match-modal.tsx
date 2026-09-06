/**
 * Celebración de match.
 *
 * Sale como modal sobre el deck en vez de como ruta propia: el match interrumpe
 * el swipe, no lo abandona — al cerrarlo se sigue exactamente donde se estaba.
 *
 * La salida a chat es la acción principal a propósito. Un match que se queda en
 * un cartel bonito no sirve de nada; el producto empieza en la conversación.
 */

import { Modal, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { ProfileAvatar, modeLabel } from '@/features/profile';
import { useTheme } from '@/hooks/use-theme';

import { ActionButton } from './action-button';

import type { MatchEvent } from './use-deck';

export function MatchModal({
  event,
  onOpenChat,
  onDismiss,
}: {
  /** El match a celebrar, o `null` para no mostrar nada. */
  event: MatchEvent | null;
  onOpenChat: (matchId: string) => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();

  return (
    <Modal
      visible={event !== null}
      transparent
      animationType="fade"
      // Android: el botón atrás cierra el modal, no la pantalla de debajo.
      onRequestClose={onDismiss}>
      {event ? (
        <View style={[styles.backdrop, { backgroundColor: theme.background + 'F2' }]}>
          <View
            accessibilityViewIsModal
            style={[
              styles.card,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}>
            <ThemedText type="label" themeColor="teal">
              Modo {modeLabel(event.match.mode)}
            </ThemedText>

            <ThemedText type="display" themeColor="brass">
              ¡Match!
            </ThemedText>

            <View style={styles.identity}>
              <ProfileAvatar avatar={event.profile.avatar} size="large" />
              <ThemedText type="body" themeColor="textSecondary" style={styles.blurb}>
                {event.profile.name} ya te había dado like. Ahora os toca hablar.
              </ThemedText>
            </View>

            <View style={styles.actions}>
              <ActionButton label="Abrir chat" onPress={() => onOpenChat(event.match.id)} />
              <ActionButton label="Seguir descubriendo" variant="secondary" onPress={onDismiss} />
            </View>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radii.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  identity: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  blurb: {
    textAlign: 'center',
  },
  actions: {
    gap: Spacing.two,
  },
});
