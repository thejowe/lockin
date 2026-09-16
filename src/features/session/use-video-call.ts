/**
 * La llamada de vídeo 1:1 de una sesión Lock-In.
 *
 * Sin servidor de señalización propio: SDP y candidatos ICE viajan por
 * `VideoSignalChannel` (ver `src/data/video-signal.ts`), tráfico efímero como
 * la presencia. Sin coordinación explícita de quién llama a quién: el
 * `profileId` menor en orden lexicográfico ofrece, lo que evita "glare" (los
 * dos ofreciendo a la vez) sin un tercer mensaje de arbitraje. Solo STUN
 * público — ver la spec para el porqué de no pagar TURN gestionado.
 *
 * `active` en `false` (fuera de ventana, sesión terminada, o web — lo decide
 * quien llama al hook) cierra y limpia sin que el resto de la pantalla tenga
 * que saberlo: por eso todo el ciclo de vida vive en un único efecto atado a
 * ese booleano.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { mediaDevices, MediaStream, RTCPeerConnection } from 'react-native-webrtc';

import { videoSignal } from '@/data';

import type { VideoSignalChannel, VideoSignalMessage } from '@/data';

/** STUN público, sin cuenta — ver la spec ("Decisiones tomadas") para el porqué de no pagar TURN. */
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

/**
 * Sin ICE restart (fuera de alcance, ver spec §6), una conexión que nunca
 * cierra se quedaría en 'conectando' para siempre si la otra parte no tiene
 * cámara, no da permiso, o simplemente no entra. 30 s es el margen que da la
 * spec para pasar a un 'error' observable en vez de un limbo silencioso.
 */
export const CONNECT_TIMEOUT_MS = 30_000;

export type VideoCallStatus = 'inactiva' | 'conectando' | 'conectada' | 'error';

export interface VideoCall {
  status: VideoCallStatus;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micOn: boolean;
  cameraOn: boolean;
  error: string | null;
  toggleMic(): void;
  toggleCamera(): void;
  hangUp(): void;
}

/** Forma mínima de una SDP para viajar (de)serializada por el canal de señalización. */
interface SessionDescriptionPayload {
  type: string;
  sdp: string;
}

/** Forma mínima de un candidato ICE para viajar (de)serializado por el canal de señalización. */
interface IceCandidatePayload {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

/**
 * Resultado de un intento de llamada. `status` se deriva de esto en vez de
 * guardarse tal cual: así el arranque de un intento nuevo se ajusta durante el
 * render (ver más abajo) sin disparar un `setState` síncrono dentro del efecto.
 */
type Outcome = 'idle' | 'conectada' | 'error' | 'colgada';

export function useVideoCall(
  sessionId: string | null,
  myProfileId: string | null,
  counterpartId: string | null,
  active: boolean,
  channel: VideoSignalChannel = videoSignal
): VideoCall {
  const canRun = Boolean(sessionId && myProfileId && counterpartId && active && Platform.OS !== 'web');

  const [outcome, setOutcome] = useState<Outcome>('idle');
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);

  const localStreamRef = useRef<MediaStream | null>(null);
  // `hangUp` cuelga desde fuera del efecto: necesita poder disparar la misma
  // limpieza sin duplicarla, de ahí guardar la función vigente en un ref.
  const cleanupRef = useRef<() => void>(() => {});
  // Guarda si el intento anterior seguía "vivo" para detectar el flanco de
  // subida de `canRun`. Es `useState`, no un ref: React desaconseja leer/
  // escribir refs durante el render (`react-hooks/refs`); este es el patrón
  // oficial de "ajustar estado cuando cambia una prop" de su propia doc.
  const [wasRunning, setWasRunning] = useState(false);

  // Arranca un intento nuevo sin arrastrar el resultado, el mute ni el error
  // del anterior. Es un ajuste de estado derivado de las props (el flanco de
  // subida de `canRun`), no una sincronización con un sistema externo — por
  // eso se hace aquí, durante el render, y no dentro del efecto de más abajo.
  if (canRun && !wasRunning) {
    setWasRunning(true);
    setOutcome('idle');
    setError(null);
    setMicOn(true);
    setCameraOn(true);
  } else if (!canRun && wasRunning) {
    setWasRunning(false);
  }

  const status: VideoCallStatus =
    !canRun || outcome === 'colgada' ? 'inactiva' : outcome === 'idle' ? 'conectando' : outcome;

  useEffect(() => {
    if (!sessionId || !myProfileId || !counterpartId || !active || Platform.OS === 'web') {
      return;
    }

    let cancelled = false;
    let closed = false;
    let leaveChannel = () => {};
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const amOfferer = myProfileId < counterpartId;

    // Ver `CONNECT_TIMEOUT_MS`: sin esto, "nadie contesta" se queda en
    // 'conectando' para siempre en vez de convertirse en un error observable.
    const connectTimeout = setTimeout(() => {
      if (cancelled) return;
      setOutcome('error');
      setError('No se pudo conectar el vídeo.');
    }, CONNECT_TIMEOUT_MS);

    const cleanup = () => {
      if (closed) return;
      closed = true;
      cancelled = true;
      clearTimeout(connectTimeout);
      leaveChannel();
      pc.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      setRemoteStream(null);
      setOutcome('colgada');
    };
    cleanupRef.current = cleanup;

    const syncConnectionState = () => {
      if (cancelled) return;
      if (pc.connectionState === 'connected') {
        clearTimeout(connectTimeout);
        setOutcome('conectada');
      } else if (pc.connectionState === 'failed') {
        clearTimeout(connectTimeout);
        setOutcome('error');
        setError('No se pudo conectar el vídeo.');
      }
    };
    pc.onconnectionstatechange = syncConnectionState;
    pc.oniceconnectionstatechange = syncConnectionState;

    // El `.d.ts` de la librería tipa estos eventos como `Event<string>`
    // genérico en vez de `RTCIceCandidateEvent`/`RTCTrackEvent` — hueco de sus
    // propios tipos, no nuestro; de ahí derivar el tipo real del propio setter
    // y castear el valor recibido a su forma real.
    pc.onicecandidate = (event: Parameters<NonNullable<typeof pc.onicecandidate>>[0]) => {
      const candidate = (event as unknown as { candidate: IceCandidatePayload | null }).candidate;
      if (candidate) {
        channel.send(sessionId, { kind: 'ice-candidate', from: myProfileId, payload: candidate });
      }
    };

    pc.ontrack = (event: Parameters<NonNullable<typeof pc.ontrack>>[0]) => {
      if (cancelled) return;
      const streams = (event as unknown as { streams: MediaStream[] }).streams;
      setRemoteStream(streams[0] ?? null);
    };

    const handleMessage = async (message: VideoSignalMessage) => {
      if (cancelled) return;
      if (message.kind === 'offer') {
        await pc.setRemoteDescription(message.payload as SessionDescriptionPayload);
        const answerDesc: SessionDescriptionPayload = await pc.createAnswer();
        if (cancelled) return;
        await pc.setLocalDescription(answerDesc);
        channel.send(sessionId, { kind: 'answer', from: myProfileId, payload: answerDesc });
      } else if (message.kind === 'answer') {
        await pc.setRemoteDescription(message.payload as SessionDescriptionPayload);
      } else if (message.kind === 'ice-candidate') {
        try {
          await pc.addIceCandidate(message.payload as IceCandidatePayload);
        } catch {
          // Candidato tardío o ya descartado: no es un fallo de la llamada.
        }
      } else if (message.kind === 'hangup') {
        cleanup();
      }
    };

    leaveChannel = channel.join(sessionId, myProfileId, {
      onMessage: (message) => {
        void handleMessage(message);
      },
      onConnection: () => {},
    });

    const start = async () => {
      try {
        const stream = await mediaDevices.getUserMedia({ audio: true, video: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        if (amOfferer) {
          const offerDesc: SessionDescriptionPayload = await pc.createOffer();
          if (cancelled) return;
          await pc.setLocalDescription(offerDesc);
          channel.send(sessionId, { kind: 'offer', from: myProfileId, payload: offerDesc });
        }
      } catch {
        if (!cancelled) {
          // Sin esto, un permiso denegado ahora quedaría pisado 30 s después
          // por el timeout de conexión, con un mensaje que ya no aplica.
          clearTimeout(connectTimeout);
          setOutcome('error');
          setError('No se pudo acceder a la cámara o al micrófono.');
        }
      }
    };

    void start();

    return () => {
      cleanup();
      cleanupRef.current = () => {};
    };
  }, [sessionId, myProfileId, counterpartId, active, channel]);

  const toggleMic = useCallback(() => {
    setMicOn((prev) => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = next;
      });
      return next;
    });
  }, []);

  const toggleCamera = useCallback(() => {
    setCameraOn((prev) => {
      const next = !prev;
      localStreamRef.current?.getVideoTracks().forEach((track) => {
        track.enabled = next;
      });
      return next;
    });
  }, []);

  const hangUp = useCallback(() => {
    if (sessionId && myProfileId) {
      channel.send(sessionId, { kind: 'hangup', from: myProfileId, payload: null });
    }
    cleanupRef.current();
  }, [channel, sessionId, myProfileId]);

  return { status, localStream, remoteStream, micOn, cameraOn, error, toggleMic, toggleCamera, hangUp };
}
