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
 * El canal no guarda nada: un offer enviado cuando la otra parte aún no está
 * se pierde, y con la ventana de 5 minutos lo normal es llegar con minutos de
 * diferencia. Por eso el offer no sale al arrancar, sino al saber que la otra
 * parte está: cada lado manda `ready` cuando tiene cámara y micrófono; quien
 * contesta responde `ready` a un `ready` (así se entera quien llega después),
 * y quien ofrece contesta a un `ready` con su offer. Da igual quién llegue
 * antes.
 *
 * `active` en `false` (fuera de ventana, sesión terminada, o web — lo decide
 * quien llama al hook) cierra y limpia sin que el resto de la pantalla tenga
 * que saberlo: por eso todo el ciclo de vida vive en un único efecto atado a
 * ese booleano.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { videoSignal } from '@/data';

import { loadWebRTC } from './webrtc';

import type { VideoSignalChannel, VideoSignalMessage } from '@/data';
import type { MediaStream } from 'react-native-webrtc';

/** STUN público, sin cuenta — ver la spec ("Decisiones tomadas") para el porqué de no pagar TURN. */
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

/**
 * Sin ICE restart (fuera de alcance, ver spec §6), una conexión que nunca
 * cierra se quedaría en 'conectando' para siempre si la otra parte no tiene
 * cámara, no da permiso, o simplemente no entra. 30 s es el margen que da la
 * spec para pasar a un 'error' observable en vez de un limbo silencioso.
 */
export const CONNECT_TIMEOUT_MS = 30_000;

/**
 * `'no-disponible'`: la build no trae el módulo nativo de WebRTC (Expo Go).
 * No es un error de la llamada, es que no puede existir — ver `webrtc.ts`.
 */
export type VideoCallStatus = 'inactiva' | 'conectando' | 'conectada' | 'error' | 'no-disponible';

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
  const webrtc = Platform.OS === 'web' ? null : loadWebRTC();
  const wanted = Boolean(sessionId && myProfileId && counterpartId && active);
  const canRun = wanted && webrtc !== null;

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
    wanted && webrtc === null && Platform.OS !== 'web'
      ? 'no-disponible'
      : !canRun || outcome === 'colgada'
        ? 'inactiva'
        : outcome === 'idle'
          ? 'conectando'
          : outcome;

  useEffect(() => {
    if (!sessionId || !myProfileId || !counterpartId || !active || !webrtc) {
      return;
    }

    const { mediaDevices, RTCPeerConnection } = webrtc;
    let cancelled = false;
    let closed = false;
    let leaveChannel = () => {};
    const amOfferer = myProfileId < counterpartId;
    // Identifica esta entrada en la llamada. Viaja en cada `ready`: uno con una
    // entrada distinta a la ya negociada es que la otra parte salió y volvió.
    const entry = Math.random().toString(36).slice(2);
    let counterpartEntry: string | null = null;
    // Cámara y micrófono ya añadidos: antes no se manda `ready` ni se responde
    // a uno, así que ningún offer llega antes de tener medios.
    let mediaReady = false;
    let connectTimeout: ReturnType<typeof setTimeout> | undefined;

    /**
     * Una negociación con una entrada concreta de la otra parte. Al volver a
     * entrar ella, se tira entera y se levanta otra con los mismos medios.
     */
    interface Peer {
      pc: InstanceType<typeof RTCPeerConnection>;
      /** Ya llegó su offer/answer: uno repetido se ignora. */
      described: boolean;
      /**
       * `setRemoteDescription` resuelto. `setLocalDescription` dispara
       * candidatos antes de que su offer/answer salga por el canal, así que al
       * otro lado llegan primero; sin descripción remota el nativo los
       * rechaza, y se guardan en `pending` hasta tenerla.
       */
      remoteApplied: boolean;
      pending: IceCandidatePayload[];
      /** El offer, creado una vez y reenviado tal cual si llega otro `ready` antes de la respuesta. */
      offer: Promise<SessionDescriptionPayload | null> | null;
    }

    // Ver `CONNECT_TIMEOUT_MS`: sin esto, "nadie contesta" se queda en
    // 'conectando' para siempre en vez de convertirse en un error observable.
    // Arranca con los medios, no antes: los diálogos de permisos del sistema
    // pueden llevarse ellos solos los 30 s.
    const startTimeout = () => {
      clearTimeout(connectTimeout);
      connectTimeout = setTimeout(() => {
        if (cancelled) return;
        setOutcome('error');
        setError('No se pudo conectar el vídeo.');
      }, CONNECT_TIMEOUT_MS);
    };

    const createPeer = (): Peer => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const self: Peer = { pc, described: false, remoteApplied: false, pending: [], offer: null };
      // Los eventos de una conexión ya sustituida no tocan el estado.
      const current = () => !cancelled && peer === self;

      const syncConnectionState = () => {
        if (!current()) return;
        if (pc.connectionState === 'connected') {
          clearTimeout(connectTimeout);
          setError(null);
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
        if (!current()) return;
        const candidate = (event as unknown as { candidate: IceCandidatePayload | null }).candidate;
        if (candidate) {
          channel.send(sessionId, { kind: 'ice-candidate', from: myProfileId, payload: candidate });
        }
      };

      pc.ontrack = (event: Parameters<NonNullable<typeof pc.ontrack>>[0]) => {
        if (!current()) return;
        const streams = (event as unknown as { streams: MediaStream[] }).streams;
        setRemoteStream(streams[0] ?? null);
      };

      const stream = localStreamRef.current;
      stream?.getTracks().forEach((track) => pc.addTrack(track, stream));
      return self;
    };

    let peer = createPeer();

    /** La otra parte se fue o volvió a entrar: conexión nueva, mismos medios. */
    const resetPeer = () => {
      const old = peer;
      peer = createPeer();
      old.pc.close();
      setRemoteStream(null);
      setError(null);
      setOutcome('idle');
    };

    const cleanup = () => {
      if (closed) return;
      closed = true;
      cancelled = true;
      clearTimeout(connectTimeout);
      // Quien se queda deja de esperar a esta conexión y vuelve a 'conectando'.
      channel.send(sessionId, { kind: 'hangup', from: myProfileId, payload: null });
      leaveChannel();
      peer.pc.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      setRemoteStream(null);
      setOutcome('colgada');
    };
    cleanupRef.current = cleanup;

    const addCandidate = async (target: Peer, candidate: IceCandidatePayload) => {
      try {
        await target.pc.addIceCandidate(candidate);
      } catch {
        // Candidato tardío o ya descartado: no es un fallo de la llamada.
      }
    };

    /** `false` si la conexión se sustituyó o se colgó mientras tanto. */
    const applyRemote = async (target: Peer, description: SessionDescriptionPayload) => {
      target.described = true;
      await target.pc.setRemoteDescription(description);
      if (cancelled || peer !== target) return false;
      target.remoteApplied = true;
      for (const candidate of target.pending.splice(0)) await addCandidate(target, candidate);
      return true;
    };

    const sendReady = () => {
      channel.send(sessionId, { kind: 'ready', from: myProfileId, payload: { entry } });
    };

    const sendOffer = async () => {
      const target = peer;
      target.offer ??= (async () => {
        const offerDesc: SessionDescriptionPayload = await target.pc.createOffer();
        if (cancelled || peer !== target) return null;
        await target.pc.setLocalDescription(offerDesc);
        return offerDesc;
      })();
      const offerDesc = await target.offer;
      if (cancelled || peer !== target || !offerDesc) return;
      channel.send(sessionId, { kind: 'offer', from: myProfileId, payload: offerDesc });
    };

    const handleMessage = async (message: VideoSignalMessage) => {
      if (cancelled) return;
      if (message.kind === 'ready') {
        // Sin medios todavía no se hace nada: el `ready` propio saldrá al
        // tenerlos.
        if (!mediaReady) return;
        const theirEntry = (message.payload as { entry?: string } | null)?.entry ?? null;
        const reentered = theirEntry !== counterpartEntry;
        counterpartEntry = theirEntry;
        if (peer.described) {
          // Repetido de la entrada ya negociada: nada que hacer.
          if (!reentered) return;
          resetPeer();
          startTimeout();
        }
        if (amOfferer) await sendOffer();
        else sendReady();
      } else if (message.kind === 'offer') {
        const target = peer;
        if (target.described) return;
        if (!(await applyRemote(target, message.payload as SessionDescriptionPayload))) return;
        const answerDesc: SessionDescriptionPayload = await target.pc.createAnswer();
        if (cancelled || peer !== target) return;
        await target.pc.setLocalDescription(answerDesc);
        channel.send(sessionId, { kind: 'answer', from: myProfileId, payload: answerDesc });
      } else if (message.kind === 'answer') {
        if (peer.described) return;
        await applyRemote(peer, message.payload as SessionDescriptionPayload);
      } else if (message.kind === 'ice-candidate') {
        const candidate = message.payload as IceCandidatePayload;
        if (peer.remoteApplied) await addCandidate(peer, candidate);
        else peer.pending.push(candidate);
      } else if (message.kind === 'hangup') {
        // Colgó o salió de la sesión: se tira su conexión y se la espera, sin
        // tiempo de espera — no es que no conecte, es que no está.
        clearTimeout(connectTimeout);
        counterpartEntry = null;
        resetPeer();
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
        stream.getTracks().forEach((track) => peer.pc.addTrack(track, stream));

        mediaReady = true;
        startTimeout();
        sendReady();
      } catch {
        if (!cancelled) {
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
  }, [sessionId, myProfileId, counterpartId, active, channel, webrtc]);

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

  // El `hangup` a la otra parte lo manda la propia limpieza: colgar y salir
  // de la sesión le avisan igual.
  const hangUp = useCallback(() => {
    cleanupRef.current();
  }, []);

  return {
    status,
    localStream,
    remoteStream,
    micOn,
    cameraOn,
    error,
    toggleMic,
    toggleCamera,
    hangUp,
  };
}
