/**
 * El hueco de la llamada de vídeo dentro de la sesión: el stream remoto ocupa
 * el hueco entero, el propio flota en una esquina, y tres controles (mic,
 * cámara, colgar) van superpuestos. Colgar no navega — cerrar la llamada es
 * independiente de salir de la sesión (ver la spec, "Por qué un fallo de
 * vídeo no bloquea el resto de la sesión").
 *
 * `active` decide si hay algo que pintar: fuera de la ventana de la sesión (o
 * ya terminada) el componente no pinta nada, así quien integra esta pieza en
 * la pantalla puede montarla siempre y dejar que decida ella sola.
 *
 * `Platform.OS === 'web'` no llega a este archivo: Metro resuelve
 * `video-call-view.web.tsx` para cualquier bundle web antes de evaluar este
 * módulo, así que `react-native-webrtc` (nativo, sin build web) nunca se
 * importa ahí — ver `use-video-call.web.ts` para la misma razón y por qué un
 * simple `if (Platform.OS === 'web')` dentro de este archivo no basta (el
 * `import` de arriba se ejecuta igual, esté o no la rama).
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Control, Opacity, Radii, Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useVideoCall, type VideoCallStatus } from './use-video-call';
import { loadWebRTC } from './webrtc';

import type { VideoSignalChannel } from '@/data';

const STATUS_TEXT: Record<VideoCallStatus, string> = {
  inactiva: 'La videollamada empieza cuando entráis los dos.',
  conectando: 'Conectando…',
  conectada: 'Esperando vídeo…',
  error: 'No se pudo conectar el vídeo.',
  'no-disponible': 'La videollamada necesita la app de desarrollo.',
};

export function VideoCallView({
  sessionId,
  myProfileId,
  counterpartId,
  active,
  channel,
}: {
  sessionId: string | null;
  myProfileId: string | null;
  counterpartId: string | null;
  active: boolean;
  channel?: VideoSignalChannel;
}) {
  const call = useVideoCall(sessionId, myProfileId, counterpartId, active, channel);
  const theme = useTheme();

  // Fuera de ventana o ya colgada: nada que pintar, sin que quien la monta
  // tenga que condicionar su presencia en el árbol.
  if (!active) return null;

  // Sin módulo nativo (Expo Go) no hay `RTCView` ni controles que valgan: solo
  // el aviso, y el resto de la sesión (reloj, presencia, chat) sigue igual.
  const RTCView = loadWebRTC()?.RTCView;
  if (!RTCView || call.status === 'no-disponible') {
    return (
      <View
        style={[
          styles.remote,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
          {STATUS_TEXT['no-disponible']}
        </ThemedText>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.remote,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      {call.remoteStream ? (
        <RTCView
          testID="video-call-remote"
          streamURL={call.remoteStream.toURL()}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
        />
      ) : (
        <ThemedText
          testID="video-call-status"
          type="small"
          themeColor="textSecondary"
          // Con la miniatura propia arriba a la derecha, el aviso se estrecha
          // por los dos lados lo mismo: sigue centrado y no se mete debajo.
          style={[styles.centeredText, call.localStream && styles.clearOfPreview]}>
          {call.error ?? STATUS_TEXT[call.status]}
        </ThemedText>
      )}

      {call.localStream && (
        <View style={[styles.local, { borderColor: theme.border }]}>
          <RTCView
            testID="video-call-local"
            streamURL={call.localStream.toURL()}
            style={StyleSheet.absoluteFill}
            objectFit="cover"
            zOrder={1}
            mirror
          />
        </View>
      )}

      <View testID="video-call-controls" style={styles.controls}>
        <CallButton
          label={call.micOn ? 'Silenciar micrófono' : 'Activar micrófono'}
          text={call.micOn ? 'Silenciar' : 'Activar mic'}
          selected={!call.micOn}
          onPress={call.toggleMic}
        />
        <CallButton
          label={call.cameraOn ? 'Apagar cámara' : 'Activar cámara'}
          selected={!call.cameraOn}
          onPress={call.toggleCamera}
        />
        <CallButton label="Colgar" tone="danger" onPress={call.hangUp} />
      </View>
    </View>
  );
}

/**
 * Botón de la llamada. `text` es lo que se lee en pantalla cuando la etiqueta
 * completa no cabe en la fila: siempre un principio de `label`, para que quien
 * maneja la app por voz pueda decir lo que ve.
 */
function CallButton({
  label,
  text = label,
  onPress,
  tone = 'quiet',
  selected = false,
}: {
  label: string;
  text?: string;
  onPress: () => void;
  tone?: 'quiet' | 'danger';
  selected?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: tone === 'danger' ? theme.danger : theme.backgroundSelected,
          opacity: pressed ? Opacity.pressed : 1,
        },
      ]}>
      <ThemedText
        type="small"
        numberOfLines={1}
        style={{ color: tone === 'danger' ? theme.onAccent : theme.text }}>
        {text}
      </ThemedText>
    </Pressable>
  );
}

/** Miniatura de la cámara propia: 3:4, como la de una videollamada de móvil. */
const SELF_PREVIEW = { width: 96, height: 128 } as const;

const styles = StyleSheet.create({
  remote: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radii.large,
    borderWidth: Stroke.hairline,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  local: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: SELF_PREVIEW.width,
    height: SELF_PREVIEW.height,
    borderRadius: Radii.medium,
    borderWidth: Stroke.hairline,
    overflow: 'hidden',
  },
  // La fila va de borde a borde de la vista remota y, si aun así no cabe (letra
  // grande del sistema), pasa a una segunda línea en vez de salirse.
  controls: {
    position: 'absolute',
    left: Spacing.two,
    right: Spacing.two,
    bottom: Spacing.two,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  centeredText: { textAlign: 'center', paddingHorizontal: Spacing.four },
  clearOfPreview: { paddingHorizontal: SELF_PREVIEW.width + Spacing.two * 2 },
  button: {
    minHeight: Control.minTouch,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
