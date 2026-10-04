/**
 * Celebración de match.
 *
 * Sale como modal sobre el deck en vez de como ruta propia: el match interrumpe
 * el swipe, no lo abandona — al cerrarlo se sigue exactamente donde se estaba.
 *
 * La salida a chat es la acción principal a propósito. Un match que se queda en
 * un cartel bonito no sirve de nada; el producto empieza en la conversación.
 *
 * Si además hay complementariedad, se nombra aquí: es el mejor icebreaker que
 * hay, y llega justo cuando la persona decide si abre el chat o cierra el modal.
 * No cambia nada del match — ya está creado, y sigue siendo un like recíproco
 * (ver `complement.ts`).
 *
 * Entrada: el velo funde (`animationType="fade"` del propio Modal) y la tarjeta
 * sube un poco y crece desde el 92 % con el muelle `pop` — un solo rebote
 * corto, lo justo para que el match se sienta como un acontecimiento y no como
 * un aviso. Con «reducir movimiento» la tarjeta aparece sin recorrido.
 */

import { Modal, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { ZoomIn, withSpring, withTiming } from 'react-native-reanimated';

import { enterUp } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import {
  BlurIntensity,
  Duration,
  Elevation,
  MaxContentWidth,
  Radii,
  ScrimAlpha,
  Spacing,
  Springs,
  Stroke,
} from '@/constants/theme';
import { ProfileAvatar, modeLabel, specialtyLabel } from '@/features/profile';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme, useThemeName } from '@/hooks/use-theme';

import { ActionButton } from './action-button';
import { complementWith } from './complement';

import type { MatchEvent } from './use-deck';

import type { Specialty } from '@/data';

/** Entrada de la tarjeta: sube 16 y crece desde 0.92, con el muelle `pop`. */
function popIn() {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 16 }, { scale: 0.92 }] },
    animations: {
      opacity: withTiming(1, { duration: Duration.fast }),
      transform: [
        { translateY: withSpring(0, Springs.pop) },
        { scale: withSpring(1, Springs.pop) },
      ],
    },
  };
}

export function MatchModal({
  event,
  onOpenChat,
  onDismiss,
  viewerSpecialties = [],
}: {
  /** El match a celebrar, o `null` para no mostrar nada. */
  event: MatchEvent | null;
  onOpenChat: (matchId: string) => void;
  onDismiss: () => void;
  /** Lo que domina quien swipea, para nombrar el encaje si lo hay. */
  viewerSpecialties?: Specialty[];
}) {
  const theme = useTheme();
  const elevation = Elevation[useThemeName()];
  const reduceMotion = useReduceMotion();
  const complement = event ? complementWith(event.profile, viewerSpecialties) : [];

  return (
    <Modal
      visible={event !== null}
      transparent
      animationType="fade"
      // Android: el botón atrás cierra el modal, no la pantalla de debajo.
      onRequestClose={onDismiss}>
      {event ? (
        <View style={[styles.backdrop, { backgroundColor: theme.background + ScrimAlpha }]}>
          {/* El deck queda detrás, esmerilado: sigue ahí, pero ya no compite. */}
          <BlurView tint="dark" intensity={BlurIntensity.sheet} style={StyleSheet.absoluteFill} />
          <Animated.View
            accessibilityViewIsModal
            entering={reduceMotion ? undefined : popIn}
            style={[
              styles.card,
              {
                backgroundColor: theme.surfaceOpaque,
                borderColor: theme.border,
                boxShadow: `inset 0px 1px 0px ${theme.glassHighlight}, ${elevation.overlay}`,
              },
            ]}>
            <ThemedText type="label" themeColor="teal" style={styles.blurb}>
              Modo {modeLabel(event.match.mode)}
            </ThemedText>

            <Animated.View entering={reduceMotion ? undefined : enterUp(2)}>
              <ThemedText type="display" style={styles.blurb}>
                ¡Match!
              </ThemedText>
            </Animated.View>

            <View style={styles.identity}>
              {/* El avatar llega un instante después que la tarjeta: primero el
                  «¡Match!», luego con quién. */}
              <Animated.View
                entering={
                  reduceMotion
                    ? undefined
                    : ZoomIn.delay(Duration.base).springify().damping(14).stiffness(200)
                }>
                <ProfileAvatar avatar={event.profile.avatar} size="large" />
              </Animated.View>
              <ThemedText type="body" themeColor="textSecondary" style={styles.blurb}>
                {event.profile.name} ya te había dado like. Ahora os toca hablar.
              </ThemedText>

              {complement.length > 0 ? (
                <ThemedText type="smallBold" themeColor="brass" style={styles.blurb}>
                  Y busca justo lo que tú dominas: {listLabels(complement)}.
                </ThemedText>
              ) : null}
            </View>

            <View style={styles.actions}>
              <ActionButton label="Abrir chat" onPress={() => onOpenChat(event.match.id)} />
              <ActionButton label="Seguir descubriendo" variant="secondary" onPress={onDismiss} />
            </View>
          </Animated.View>
        </View>
      ) : null}
    </Modal>
  );
}

/** "Diseño", "Diseño y Ventas", "Diseño, Ventas y Datos". */
function listLabels(values: Specialty[]): string {
  const labels = values.map(specialtyLabel);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
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
    borderRadius: Radii.sheet,
    borderWidth: Stroke.hairline,
    overflow: 'hidden',
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
