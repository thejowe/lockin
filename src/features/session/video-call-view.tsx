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
import { Radii, Spacing } from '@/constants/theme';
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
        <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
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

      <View style={styles.controls}>
        <CallButton
          label={call.micOn ? 'Silenciar micrófono' : 'Activar micrófono'}
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

function CallButton({
  label,
  onPress,
  tone = 'quiet',
  selected = false,
}: {
  label: string;
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
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <ThemedText type="small" style={{ color: tone === 'danger' ? theme.onAccent : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  remote: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radii.large,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  local: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: 96,
    height: 128,
    borderRadius: Radii.medium,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  controls: {
    position: 'absolute',
    bottom: Spacing.two,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  centeredText: { textAlign: 'center', paddingHorizontal: Spacing.four },
  button: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
