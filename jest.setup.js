/* eslint-env jest */

/**
 * Arranque común de los tests.
 *
 * Reanimated y gesture-handler tocan el hilo de UI nativo: bajo Jest no existe,
 * así que se sustituyen por sus mocks oficiales. Sin esto, cualquier test que
 * importe el deck de swipe revienta al montar.
 */

require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// `react-native-keyboard-controller` es un módulo nativo: sin el mock oficial,
// importar `src/app/_layout.tsx` revienta con "doesn't seem to be linked".
jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest')
);

// `expo-font` intenta cargar las fuentes de marca; en tests damos por hecho que
// ya están listas para que las pantallas rendericen su árbol real.
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: jest.fn(() => Promise.resolve()),
}));

// Matchers de accesibilidad de RNTL: `toBeSelected`, `toBeDisabled`,
// `toBeOnTheScreen`… Son la forma legible de aseverar estado de a11y.
require('@testing-library/react-native/dist/matchers/extend-expect');

// `@supabase/supabase-js` guarda la sesión en AsyncStorage, que es un módulo
// nativo: al importarlo bajo Jest revienta con "NativeModule: AsyncStorage is
// null". Este es el mock oficial del paquete. Hace falta desde que
// `src/data/active.ts` importa el backend de Supabase para poder elegirlo.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// `react-native-safe-area-context` lee insets del nativo: bajo Jest no hay
// ninguno y `useSafeAreaInsets` lanza "No safe area value available". Este es el
// mock oficial del paquete; devuelve insets a cero, que es justo lo que Jest no
// puede medir de todos modos.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default
);

// `expo-notifications` es nativo. `SessionReminderSync` se monta en el layout de
// tabs, así que cualquier test que lo renderice lo importa. Este doble cubre
// solo lo que usa `src/features/session/notifications-port.ts`; los tests que
// necesiten otro comportamiento sustituyen las funciones con `mockResolvedValue`.
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('notification-id')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
}));

// `react-native-webrtc` es un módulo nativo (cámara, micrófono, RTCPeerConnection
// real): no existe bajo Jest. El doble simula lo justo para que `use-video-call`
// recorra su máquina de estados sin red real: cuando las dos descripciones
// (local y remota) quedan puestas se da la conexión por hecha —no hay forma de
// simular ICE de verdad en Node— y `setRemoteDescription` dispara `ontrack` con
// un stream remoto falso, como haría el navegador al llegar vídeo.
// `loadWebRTC` (src/features/session/webrtc.ts) comprueba que la build traiga
// el módulo nativo antes de hacer `require`; bajo Jest el doble de arriba lo
// sustituye, así que basta con que la comprobación lo vea presente.
require('react-native').NativeModules.WebRTCModule = {};

jest.mock('react-native-webrtc', () => {
  class MockMediaStreamTrack {
    constructor(kind) {
      this.kind = kind;
      this.enabled = true;
      this.stopped = false;
    }

    stop() {
      this.stopped = true;
      this.enabled = false;
    }
  }

  let nextStreamId = 0;

  class MockMediaStream {
    constructor(tracks = []) {
      this.id = `mock-stream-${nextStreamId++}`;
      this._tracks = tracks;
    }

    getTracks() {
      return this._tracks;
    }

    getAudioTracks() {
      return this._tracks.filter((track) => track.kind === 'audio');
    }

    getVideoTracks() {
      return this._tracks.filter((track) => track.kind === 'video');
    }

    toURL() {
      return `mock-stream:${this.id}`;
    }
  }

  class MockRTCPeerConnection {
    constructor(config) {
      this.config = config;
      this.localDescription = null;
      this.remoteDescription = null;
      this.connectionState = 'new';
      this.iceConnectionState = 'new';
      this.onicecandidate = null;
      this.ontrack = null;
      this.onconnectionstatechange = null;
      this.oniceconnectionstatechange = null;
      this.senders = [];
      this.closed = false;

      this.createOffer = jest.fn(async () => ({ type: 'offer', sdp: 'mock-offer-sdp' }));
      this.createAnswer = jest.fn(async () => ({ type: 'answer', sdp: 'mock-answer-sdp' }));

      this.setLocalDescription = jest.fn(async (description) => {
        this.localDescription = description;
        // Simula la recogida de candidatos ICE que dispararía el nativo real.
        if (this.onicecandidate) {
          this.onicecandidate({
            candidate: { candidate: 'mock-candidate', sdpMid: '0', sdpMLineIndex: 0 },
          });
        }
        this._maybeConnect();
      });

      this.setRemoteDescription = jest.fn(async (description) => {
        this.remoteDescription = description;
        // El stream remoto "llega" en cuanto hay descripción remota — no hay
        // negociación real de tracks en este doble.
        if (this.ontrack) {
          const remoteStream = new MockMediaStream([
            new MockMediaStreamTrack('audio'),
            new MockMediaStreamTrack('video'),
          ]);
          this.ontrack({ streams: [remoteStream] });
        }
        this._maybeConnect();
      });

      this.addIceCandidate = jest.fn(async () => {});

      this.close = jest.fn(() => {
        this.closed = true;
        this.connectionState = 'closed';
        this.iceConnectionState = 'closed';
      });
    }

    addTrack(track, stream) {
      const sender = { track, stream };
      this.senders.push(sender);
      return sender;
    }

    _maybeConnect() {
      if (this.closed || !this.localDescription || !this.remoteDescription) return;
      this.connectionState = 'connected';
      this.iceConnectionState = 'connected';
      if (this.onconnectionstatechange) this.onconnectionstatechange();
      if (this.oniceconnectionstatechange) this.oniceconnectionstatechange();
    }
  }

  const mediaDevices = {
    getUserMedia: jest.fn(
      async () =>
        new MockMediaStream([new MockMediaStreamTrack('audio'), new MockMediaStreamTrack('video')])
    ),
  };

  // No pinta nada real: bajo Jest no hay cámara ni decodificador de vídeo. Se
  // deja como `View` sin más para que los tests puedan localizarlo por
  // `testID`/`accessibilityLabel` sin depender del nativo.
  function RTCView(props) {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, {
      testID: props.testID,
      accessibilityLabel: props.streamURL,
    });
  }

  return {
    RTCPeerConnection: MockRTCPeerConnection,
    RTCView,
    MediaStream: MockMediaStream,
    mediaDevices,
  };
});
