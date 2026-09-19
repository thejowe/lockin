/**
 * Carga perezosa de `react-native-webrtc`.
 *
 * Expo Go no lleva ese módulo nativo: un `import` estático al principio de
 * `use-video-call.ts` / `video-call-view.tsx` lo evalúa al arrancar la app y
 * la rompe entera antes de pintar nada. Aquí se hace `require` solo cuando
 * alguien pide vídeo, dentro de un `try`, y si no hay módulo nativo se
 * devuelve `null` para que la pantalla de sesión degrade a un aviso ("La
 * videollamada necesita la app de desarrollo") en vez de caerse.
 *
 * Solo `import type` desde la librería en el resto del feature: se borra al
 * compilar, no ejecuta nada.
 */

import { NativeModules } from 'react-native';

import type * as WebRTC from 'react-native-webrtc';

export type WebRTCModule = typeof WebRTC;

let cached: WebRTCModule | null | undefined;

/**
 * El módulo de `react-native-webrtc`, o `null` si esta build no lo trae
 * (Expo Go, o un dev client compilado antes de añadir la dependencia).
 * El resultado se recuerda: un `require` fallido no se reintenta en cada render.
 */
export function loadWebRTC(): WebRTCModule | null {
  if (cached !== undefined) return cached;

  // La librería solo se queja si `NativeModules.WebRTCModule === null`; en
  // Expo Go es `undefined` y el fallo llega más tarde y más lejos (al crear
  // el primer `RTCPeerConnection`). Se comprueba a mano y se evita el `require`.
  if (NativeModules.WebRTCModule == null) {
    cached = null;
    return cached;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('react-native-webrtc') as WebRTCModule;
  } catch {
    cached = null;
  }
  return cached;
}
