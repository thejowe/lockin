/**
 * `useVideoCall` contra el doble de `react-native-webrtc` de `jest.setup.js` y
 * el canal de señalización en memoria de `src/data/video-signal.ts`.
 *
 * Ojo: en RNTL 14 `renderHook`/`rerender` son asíncronos (ver otros tests del
 * bloque, p. ej. `use-counterpart-presence.test.ts`).
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { RTCPeerConnection } from 'react-native-webrtc';

import { createMemoryVideoSignalAdapter } from '@/data';

import { useVideoCall } from './use-video-call';

/** Deja correr varias rondas de microtareas sin depender de temporizadores reales. */
async function flushMicrotasks(rounds = 10) {
  for (let i = 0; i < rounds; i += 1) {
    await act(async () => {});
  }
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useVideoCall', () => {
  it('arranca inactiva y sin unirse al canal mientras no está activa', async () => {
    const channel = createMemoryVideoSignalAdapter();
    const joinSpy = jest.spyOn(channel, 'join');

    const { result } = await renderHook(() => useVideoCall('s1', 'ana', 'bea', false, channel));

    expect(result.current.status).toBe('inactiva');
    expect(joinSpy).not.toHaveBeenCalled();
  });

  it('pasa a conectando en cuanto está activa, aunque nadie responda', async () => {
    const channel = createMemoryVideoSignalAdapter();
    const { result, rerender } = await renderHook(
      ({ active }: { active: boolean }) => useVideoCall('s1', 'ana', 'bea', active, channel),
      { initialProps: { active: false } }
    );
    expect(result.current.status).toBe('inactiva');

    await rerender({ active: true });
    await flushMicrotasks();

    // Sin nadie al otro lado que conteste, la conexión nunca completa: se
    // queda en 'conectando' — nunca llega a 'conectada' ni a 'error'.
    expect(result.current.status).toBe('conectando');
  });

  it('el profileId menor en orden lexicográfico ofrece; el mayor espera', async () => {
    const channelAna = createMemoryVideoSignalAdapter();
    const sendAna = jest.spyOn(channelAna, 'send');
    await renderHook(() => useVideoCall('s1', 'ana', 'bea', true, channelAna));
    await waitFor(() =>
      expect(sendAna).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ kind: 'offer', from: 'ana' })
      )
    );

    const channelBea = createMemoryVideoSignalAdapter();
    const sendBea = jest.spyOn(channelBea, 'send');
    await renderHook(() => useVideoCall('s1', 'bea', 'ana', true, channelBea));
    await flushMicrotasks();

    expect(sendBea).not.toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ kind: 'offer' })
    );
  });

  it('las dos partes acaban en conectada tras intercambiar offer/answer/ICE', async () => {
    const channel = createMemoryVideoSignalAdapter();

    const { result } = await renderHook(() => ({
      ana: useVideoCall('s1', 'ana', 'bea', true, channel),
      bea: useVideoCall('s1', 'bea', 'ana', true, channel),
    }));

    await waitFor(() => expect(result.current.ana.status).toBe('conectada'));
    await waitFor(() => expect(result.current.bea.status).toBe('conectada'));

    expect(result.current.ana.remoteStream).not.toBeNull();
    expect(result.current.bea.remoteStream).not.toBeNull();
  });

  it('active=false limpia la conexión: cierra el RTCPeerConnection y suelta el stream local', async () => {
    const addTrackSpy = jest.spyOn(RTCPeerConnection.prototype, 'addTrack');
    const channel = createMemoryVideoSignalAdapter();

    const { result, rerender } = await renderHook(
      ({ active }: { active: boolean }) => useVideoCall('s1', 'ana', 'bea', active, channel),
      { initialProps: { active: true } }
    );

    await waitFor(() => expect(addTrackSpy).toHaveBeenCalled());
    const pc = addTrackSpy.mock.instances[0] as InstanceType<typeof RTCPeerConnection>;
    expect(pc.close).not.toHaveBeenCalled();

    await rerender({ active: false });

    expect(pc.close).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('inactiva');
    expect(result.current.localStream).toBeNull();
    expect(result.current.remoteStream).toBeNull();
  });

  it('toggleMic/toggleCamera cambian el estado expuesto y los tracks del stream local', async () => {
    const channel = createMemoryVideoSignalAdapter();
    const { result } = await renderHook(() => useVideoCall('s1', 'ana', 'bea', true, channel));

    await waitFor(() => expect(result.current.localStream).not.toBeNull());
    expect(result.current.micOn).toBe(true);
    expect(result.current.cameraOn).toBe(true);

    await act(async () => {
      result.current.toggleMic();
    });
    expect(result.current.micOn).toBe(false);
    expect(result.current.localStream!.getAudioTracks()[0].enabled).toBe(false);

    await act(async () => {
      result.current.toggleCamera();
    });
    expect(result.current.cameraOn).toBe(false);
    expect(result.current.localStream!.getVideoTracks()[0].enabled).toBe(false);

    await act(async () => {
      result.current.toggleMic();
    });
    expect(result.current.micOn).toBe(true);
    expect(result.current.localStream!.getAudioTracks()[0].enabled).toBe(true);
  });
});
