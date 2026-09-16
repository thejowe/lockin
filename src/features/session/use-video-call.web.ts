/**
 * Variante web de `useVideoCall`: `react-native-webrtc` es un módulo nativo
 * sin build web (ver la spec, "Por qué solo funciona en build de
 * dispositivo"), así que ni siquiera se importa aquí — hacerlo revienta
 * `expo export --platform web` al cargar un native module inexistente en
 * cuanto el archivo se evalúa, esté o no la rama `Platform.OS === 'web'`.
 * Metro resuelve este archivo en vez de `use-video-call.ts` para cualquier
 * bundle `web`, igual que `use-color-scheme.web.ts` con `use-color-scheme.ts`.
 *
 * Devuelve siempre `'inactiva'`: en web no hay llamada que levantar, solo el
 * aviso de `video-call-view.web.tsx`.
 */

import type { VideoCall, VideoCallStatus } from './use-video-call';

export type { VideoCall, VideoCallStatus };

export function useVideoCall(): VideoCall {
  return {
    status: 'inactiva',
    localStream: null,
    remoteStream: null,
    micOn: false,
    cameraOn: false,
    error: null,
    toggleMic: () => {},
    toggleCamera: () => {},
    hangUp: () => {},
  };
}
