/**
 * `useVideoCall` contra el doble de `react-native-webrtc` de `jest.setup.js` y
 * el canal de señalización en memoria de `src/data/video-signal.ts`.
 *
 * Ojo: en RNTL 14 `renderHook`/`rerender` son asíncronos (ver otros tests del
 * bloque, p. ej. `use-counterpart-presence.test.ts`).
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { mediaDevices, RTCPeerConnection } from 'react-native-webrtc';

import { createMemoryVideoSignalAdapter } from '@/data';

import { CONNECT_TIMEOUT_MS, useVideoCall } from './use-video-call';

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

  it('permiso de cámara/micrófono denegado deja error sin crashear, con el resto de la sesión intacto', async () => {
    const getUserMediaSpy = jest
      .spyOn(mediaDevices, 'getUserMedia')
      .mockRejectedValueOnce(new Error('NotAllowedError'));
    const channel = createMemoryVideoSignalAdapter();

    const { result } = await renderHook(() => useVideoCall('s1', 'ana', 'bea', true, channel));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('No se pudo acceder a la cámara o al micrófono.');
    expect(result.current.localStream).toBeNull();
    expect(getUserMediaSpy).toHaveBeenCalled();
  });

  it('sin respuesta de la otra parte en el tiempo de espera, pasa a error en vez de quedarse conectando para siempre', async () => {
    jest.useFakeTimers();
    try {
      const channel = createMemoryVideoSignalAdapter();
      const { result } = await renderHook(() => useVideoCall('s1', 'ana', 'bea', true, channel));

      await flushMicrotasks();
      expect(result.current.status).toBe('conectando');

      await act(async () => {
        jest.advanceTimersByTime(CONNECT_TIMEOUT_MS);
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('No se pudo conectar el vídeo.');
    } finally {
      jest.useRealTimers();
    }
  });

  it('colgar sale del canal y cierra la conexión: un mensaje tardío no revive el estado', async () => {
    const addTrackSpy = jest.spyOn(RTCPeerConnection.prototype, 'addTrack');
    const channel = createMemoryVideoSignalAdapter();
    const { result } = await renderHook(() => useVideoCall('s1', 'ana', 'bea', true, channel));

    await waitFor(() => expect(addTrackSpy).toHaveBeenCalled());
    const pc = addTrackSpy.mock.instances[0] as InstanceType<typeof RTCPeerConnection>;

    await act(async () => {
      result.current.hangUp();
    });

    expect(pc.close).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('inactiva');
    expect(result.current.localStream).toBeNull();
    expect(result.current.remoteStream).toBeNull();

    // 'bea' manda un offer tarde, como si no supiera todavía que 'ana' colgó:
    // 'ana' ya salió del canal (memory adapter borra su entrada al salir), así
    // que no debe llegarle ni revivir nada.
    await act(async () => {
      channel.send('s1', {
        kind: 'offer',
        from: 'bea',
        payload: { type: 'offer', sdp: 'late-offer' },
      });
    });
    await flushMicrotasks();

    expect(result.current.status).toBe('inactiva');
    expect(result.current.remoteStream).toBeNull();
    expect(pc.close).toHaveBeenCalledTimes(1);
  });

  it('volver a entrar tras colgar levanta una llamada nueva sin arrastrar el estado de la anterior', async () => {
    const addTrackSpy = jest.spyOn(RTCPeerConnection.prototype, 'addTrack');
    const channel = createMemoryVideoSignalAdapter();
    const { result, rerender } = await renderHook(
      ({ active }: { active: boolean }) => useVideoCall('s1', 'ana', 'bea', active, channel),
      { initialProps: { active: true } }
    );

    await waitFor(() => expect(addTrackSpy).toHaveBeenCalled());
    const firstPc = addTrackSpy.mock.instances[0] as InstanceType<typeof RTCPeerConnection>;

    await act(async () => {
      result.current.toggleMic();
    });
    expect(result.current.micOn).toBe(false);

    await rerender({ active: false });
    expect(firstPc.close).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('inactiva');
    expect(result.current.localStream).toBeNull();

    await rerender({ active: true });
    await waitFor(() => expect(addTrackSpy.mock.instances.length).toBeGreaterThan(1));
    const secondPc = addTrackSpy.mock.instances[
      addTrackSpy.mock.instances.length - 1
    ] as InstanceType<typeof RTCPeerConnection>;

    expect(secondPc).not.toBe(firstPc);
    expect(firstPc.close).toHaveBeenCalledTimes(1);
    // Ni el mute ni el error de la llamada colgada sobreviven a la nueva.
    expect(result.current.micOn).toBe(true);
    expect(result.current.error).toBeNull();
    await waitFor(() => expect(result.current.localStream).not.toBeNull());
    expect(result.current.status).not.toBe('error');
  });
});
