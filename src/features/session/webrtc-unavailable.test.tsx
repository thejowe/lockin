/**
 * Expo Go no trae `react-native-webrtc`: la sesión tiene que arrancar igual y
 * mostrar el aviso en vez de romper. Se simula forzando `loadWebRTC` a `null`.
 */

import { render, renderHook, screen } from '@testing-library/react-native';

import { createMemoryVideoSignalAdapter } from '@/data';

import { useVideoCall } from './use-video-call';
import { VideoCallView } from './video-call-view';
import * as webrtc from './webrtc';

describe('sin módulo nativo de WebRTC (Expo Go)', () => {
  beforeEach(() => {
    jest.spyOn(webrtc, 'loadWebRTC').mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('el hook informa "no-disponible" y no toca la señalización', async () => {
    const channel = createMemoryVideoSignalAdapter();
    const join = jest.spyOn(channel, 'join');

    const { result } = await renderHook(() => useVideoCall('s1', 'ana', 'bea', true, channel));

    expect(result.current.status).toBe('no-disponible');
    expect(join).not.toHaveBeenCalled();
  });

  it('fuera de ventana sigue "inactiva", sin aviso', async () => {
    const { result } = await renderHook(() => useVideoCall('s1', 'ana', 'bea', false));

    expect(result.current.status).toBe('inactiva');
  });

  it('la vista pinta el aviso y ningún control', async () => {
    await render(<VideoCallView sessionId="s1" myProfileId="ana" counterpartId="bea" active />);

    expect(screen.getByText('La videollamada necesita la app de desarrollo.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Colgar' })).toBeNull();
  });
});

describe('loadWebRTC', () => {
  it('devuelve null si el módulo nativo no está registrado', () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    jest.isolateModules(() => {
      const { NativeModules } = require('react-native');
      const previous = NativeModules.WebRTCModule;
      delete NativeModules.WebRTCModule;
      try {
        const fresh = require('./webrtc') as typeof webrtc;
        expect(fresh.loadWebRTC()).toBeNull();
      } finally {
        NativeModules.WebRTCModule = previous;
      }
    });
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
});
