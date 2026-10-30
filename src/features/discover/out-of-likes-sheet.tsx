/**
 * La hoja que sale cuando el servidor rechaza una decisión por cupo
 * (`QuotaExceededError`) o por falta de Premium (`PremiumRequiredError`).
 *
 * Sube desde abajo sobre el deck, que se queda donde estaba: la carta no se ha
 * descartado, y al cerrar se sigue exactamente ahí. La hora de «Sin likes hasta
 * las HH:MM» sale de `resetsAt`, que manda el servidor, y se enseña en la zona
 * del dispositivo; nunca se calcula con el reloj del móvil, que puede ir
 * adelantado o atrasado.
 *
 * Solo ofrece Premium cuando Premium lo arregla: el tope antiabuso (300 al día)
 * y el Boost (que ya es de Premium) se cierran con «Entendido».
 */

import { Modal, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { enterUp } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { Elevation, MaxContentWidth, Radii, ScrimAlpha, Spacing, Stroke } from '@/constants/theme';
import { FREE_LIKES_PER_DAY, PREMIUM_SUPERS_PER_WEEK } from '@/data';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme, useThemeName } from '@/hooks/use-theme';

import { ActionButton } from './action-button';

import type { Blocked } from './use-deck';

/** «20:30», en la zona del dispositivo. */
function clock(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** «el martes 27 de octubre a las 20:30», o `null` si la fecha no se entiende. */
function dayAndClock(iso: string | null): string | null {
  if (iso === null || Number.isNaN(Date.parse(iso))) return null;
  const day = new Date(iso).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return `el ${day} a las ${clock(iso)}`;
}

interface Copy {
  title: string;
  body: string;
  /** Si Premium lo arregla. */
  upgrade: boolean;
}

function copyFor(blocked: Exclude<Blocked, null>): Copy {
  if (blocked === 'premium') {
    return {
      title: 'Esto es de Premium',
      body: 'Deshacer y el Boost son de Premium.',
      upgrade: true,
    };
  }

  const when = dayAndClock(blocked.resetsAt);
  switch (blocked.kind) {
    case 'likes':
      return {
        title:
          blocked.resetsAt !== null && !Number.isNaN(Date.parse(blocked.resetsAt))
            ? `Sin likes hasta las ${clock(blocked.resetsAt)}`
            : 'Sin likes por ahora',
        body: `Has gastado tus ${FREE_LIKES_PER_DAY} likes de hoy. Con Premium no hay límite.`,
        upgrade: true,
      };
    case 'supers':
      return {
        title: 'Sin Super Likes por ahora',
        body: when
          ? `Tu próximo Super Like llega ${when}. Con Premium tienes ${PREMIUM_SUPERS_PER_WEEK} a la semana.`
          : `Con Premium tienes ${PREMIUM_SUPERS_PER_WEEK} a la semana.`,
        upgrade: true,
      };
    case 'boost':
      return {
        title: 'Boost no disponible',
        body: when ? `Podrás usar otro ${when}.` : 'Ya has usado tu Boost de este mes.',
        upgrade: false,
      };
    case 'abuse':
      return {
        title: 'Demasiados likes por hoy',
        body: 'Has dado demasiados likes hoy. Inténtalo más tarde.',
        upgrade: false,
      };
  }
}

export function OutOfLikesSheet({
  blocked,
  onClose,
  onUpgrade,
  isPremium = false,
}: {
  /** Qué ha frenado la decisión, o `null` con la hoja cerrada. */
  blocked: Blocked;
  onClose: () => void;
  /** «Hazte Premium»: abre el paywall. */
  onUpgrade: () => void;
  /** Con Premium ya activo, ofrecerlo no arregla nada. */
  isPremium?: boolean;
}) {
  const theme = useTheme();
  const elevation = Elevation[useThemeName()];
  const reduceMotion = useReduceMotion();
  const copy = blocked ? copyFor(blocked) : null;
  const upgrade = copy?.upgrade === true && !isPremium;

  return (
    <Modal
      testID="out-of-likes-modal"
      visible={blocked !== null}
      transparent
      animationType="fade"
      // Android: el botón atrás cierra la hoja, no la pantalla de debajo.
      onRequestClose={onClose}>
      {copy ? (
        <View style={[styles.backdrop, { backgroundColor: theme.background + ScrimAlpha }]}>
          <Animated.View
            accessibilityViewIsModal
            entering={reduceMotion ? undefined : enterUp(0)}
            style={[
              styles.sheet,
              {
                backgroundColor: theme.surfaceOpaque,
                borderColor: theme.border,
                boxShadow: `inset 0px 1px 0px ${theme.glassHighlight}, ${elevation.overlay}`,
              },
            ]}>
            <View style={styles.text}>
              <ThemedText type="subtitle" style={styles.centered}>
                {copy.title}
              </ThemedText>
              <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
                {copy.body}
              </ThemedText>
            </View>

            <View style={styles.actions}>
              {upgrade ? (
                <>
                  <ActionButton label="Hazte Premium" onPress={onUpgrade} />
                  <ActionButton label="Ahora no" variant="secondary" onPress={onClose} />
                </>
              ) : (
                <ActionButton label="Entendido" onPress={onClose} />
              )}
            </View>
          </Animated.View>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: Spacing.three,
  },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
    padding: Spacing.four,
    borderRadius: Radii.sheet,
    borderWidth: Stroke.hairline,
    overflow: 'hidden',
  },
  text: {
    gap: Spacing.two,
  },
  centered: {
    textAlign: 'center',
  },
  actions: {
    gap: Spacing.two,
  },
});
