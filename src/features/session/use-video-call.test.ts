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

  it('el profileId menor en orden lexicográfico ofrece; el mayor solo contesta', async () => {
    const channel = createMemoryVideoSignalAdapter();
    const send = jest.spyOn(channel, 'send');

    const { result } = await renderHook(() => ({
      ana: useVideoCall('s1', 'ana', 'bea', true, channel),
      bea: useVideoCall('s1', 'bea', 'ana', true, channel),
    }));
    await waitFor(() => expect(result.current.bea.status).toBe('conectada'));

    const sent = send.mock.calls.map(([, message]) => `${message.from}:${message.kind}`);
    expect(sent).toContain('ana:offer');
    expect(sent).toContain('bea:answer');
    expect(sent).not.toContain('bea:offer');
  });

  // El canal no guarda nada: un mensaje enviado a una sala donde la otra parte
  // aún no está se pierde. Con la ventana de 5 minutos lo normal es llegar con
  // minutos de diferencia, así que el orden de llegada no puede decidir si
  // conecta (hallazgo del comprobador, 2026-09-27, `docs/plan/todo/video.md`).
  it('conecta aunque quien ofrece entre primero y la otra parte llegue más tarde', async () => {
    const channel = createMemoryVideoSignalAdapter();

    const ana = await renderHook(() => useVideoCall('s1', 'ana', 'bea', true, channel));
    await waitFor(() => expect(ana.result.current.localStream).not.toBeNull());
    await flushMicrotasks();

    const bea = await renderHook(() => useVideoCall('s1', 'bea', 'ana', true, channel));

    await waitFor(() => expect(bea.result.current.status).toBe('conectada'));
    await waitFor(() => expect(ana.result.current.status).toBe('conectada'));
  });

  it('conecta aunque quien contesta entre primero y quien ofrece llegue más tarde', async () => {
    const channel = createMemoryVideoSignalAdapter();

    const bea = await renderHook(() => useVideoCall('s1', 'bea', 'ana', true, channel));
    await waitFor(() => expect(bea.result.current.localStream).not.toBeNull());
    await flushMicrotasks();

    const ana = await renderHook(() => useVideoCall('s1', 'ana', 'bea', true, channel));

    await waitFor(() => expect(ana.result.current.status).toBe('conectada'));
    await waitFor(() => expect(bea.result.current.status).toBe('conectada'));
  });

  // `setLocalDescription` dispara `onicecandidate` antes de que el offer salga
  // por el canal, así que al otro lado los primeros candidatos llegan sin
  // descripción remota, y `addIceCandidate` los rechaza en el nativo real.
  it('los candidatos ICE que llegan antes que el offer se aplican al llegar este, no se pierden', async () => {
    const addTrackSpy = jest.spyOn(RTCPeerConnection.prototype, 'addTrack');
    const channel = createMemoryVideoSignalAdapter();
    await renderHook(() => useVideoCall('s1', 'bea', 'ana', true, channel));

    await waitFor(() => expect(addTrackSpy).toHaveBeenCalled());
    const pc = addTrackSpy.mock.instances[0] as InstanceType<typeof RTCPeerConnection>;
    const applied: unknown[] = [];
    // Como el nativo: sin descripción remota, el candidato se rechaza.
    jest.mocked(pc.addIceCandidate).mockImplementation(async (candidate) => {
      if (!pc.remoteDescription) throw new Error('InvalidStateError: no remote description');
      applied.push(candidate);
    });

    const early = { candidate: 'early-candidate', sdpMid: '0', sdpMLineIndex: 0 };
    await act(async () => {
      channel.send('s1', { kind: 'ice-candidate', from: 'ana', payload: early });
      channel.send('s1', { kind: 'offer', from: 'ana', payload: { type: 'offer', sdp: 'x' } });
    });
    await flushMicrotasks();

    expect(applied).toEqual([early]);
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

  // Los diálogos de permisos del sistema pueden estar abiertos más de 30 s
  // (comprobador, 2026-09-27: 32 s): ese tiempo no es de la conexión.
  it('el tiempo de espera cuenta desde que hay cámara y micrófono, no mientras se piden los permisos', async () => {
    let grant: (stream: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      grant = resolve;
    });
    const real = mediaDevices.getUserMedia;
    jest
      .spyOn(mediaDevices, 'getUserMedia')
      .mockImplementationOnce(async (constraints: Parameters<typeof real>[0]) => {
        await pending;
        return real(constraints);
      });
    jest.useFakeTimers();
    try {
      const channel = createMemoryVideoSignalAdapter();
      const { result } = await renderHook(() => useVideoCall('s1', 'ana', 'bea', true, channel));

      await act(async () => {
        jest.advanceTimersByTime(CONNECT_TIMEOUT_MS);
      });
      expect(result.current.status).toBe('conectando');

      await act(async () => {
        grant(null);
      });
      await flushMicrotasks();
      await act(async () => {
        jest.advanceTimersByTime(CONNECT_TIMEOUT_MS - 1);
      });
      expect(result.current.status).toBe('conectando');

      await act(async () => {
        jest.advanceTimersByTime(1);
      });
      expect(result.current.status).toBe('error');
    } finally {
      jest.useRealTimers();
    }
  });

  it('tras el tiempo de espera, si la otra parte llega por fin, la llamada conecta igual', async () => {
    const channel = createMemoryVideoSignalAdapter();
    jest.useFakeTimers();
    const ana = await renderHook(() => useVideoCall('s1', 'ana', 'bea', true, channel));
    try {
      await flushMicrotasks();
      await act(async () => {
        jest.advanceTimersByTime(CONNECT_TIMEOUT_MS);
      });
      expect(ana.result.current.status).toBe('error');
    } finally {
      jest.useRealTimers();
    }

    const bea = await renderHook(() => useVideoCall('s1', 'bea', 'ana', true, channel));

    await waitFor(() => expect(ana.result.current.status).toBe('conectada'));
    await waitFor(() => expect(bea.result.current.status).toBe('conectada'));
    expect(ana.result.current.error).toBeNull();
  });

  // Spec §6: volver a entrar levanta una llamada nueva desde cero. Quien se
  // queda tiene todavía la conexión vieja, que ya no lleva a ningún sitio.
  it.each([
    ['quien contesta', 'bea', 'ana'],
    ['quien ofrece', 'ana', 'bea'],
  ])(
    'si %s sale y vuelve a entrar, las dos partes vuelven a conectar',
    async (_, leaver, stayer) => {
      const channel = createMemoryVideoSignalAdapter();
      const staying = await renderHook(() => useVideoCall('s1', stayer, leaver, true, channel));
      const leaving = await renderHook(
        ({ active }: { active: boolean }) => useVideoCall('s1', leaver, stayer, active, channel),
        { initialProps: { active: true } }
      );
      await waitFor(() => expect(staying.result.current.status).toBe('conectada'));
      await waitFor(() => expect(leaving.result.current.status).toBe('conectada'));

      await leaving.rerender({ active: false });
      // Quien se queda se entera y espera, con su cámara, en vez de quedarse
      // con la imagen congelada de la llamada que ya no existe.
      await waitFor(() => expect(staying.result.current.remoteStream).toBeNull());
      expect(staying.result.current.status).toBe('conectando');
      expect(staying.result.current.localStream).not.toBeNull();

      await leaving.rerender({ active: true });

      await waitFor(() => expect(leaving.result.current.status).toBe('conectada'));
      await waitFor(() => expect(staying.result.current.status).toBe('conectada'));
      expect(staying.result.current.remoteStream).not.toBeNull();
    }
  );

  it('si la otra parte desaparece sin avisar (app cerrada, sin red) y vuelve, se reconecta', async () => {
    const channel = createMemoryVideoSignalAdapter();
    // Su `hangup` nunca llega: es lo que pasa si el proceso muere.
    const lossy = {
      join: channel.join.bind(channel),
      send: (sessionId: string, message: Parameters<typeof channel.send>[1]) => {
        if (message.kind !== 'hangup') channel.send(sessionId, message);
      },
    };
    const ana = await renderHook(() => useVideoCall('s1', 'ana', 'bea', true, channel));
    const bea = await renderHook(
      ({ active }: { active: boolean }) => useVideoCall('s1', 'bea', 'ana', active, lossy),
      { initialProps: { active: true } }
    );
    await waitFor(() => expect(ana.result.current.status).toBe('conectada'));

    await bea.rerender({ active: false });
    await flushMicrotasks();
    // Sin aviso, ana no sabe nada todavía.
    expect(ana.result.current.status).toBe('conectada');

    await bea.rerender({ active: true });

    await waitFor(() => expect(bea.result.current.status).toBe('conectada'));
    await waitFor(() => expect(ana.result.current.remoteStream).not.toBeNull());
    expect(ana.result.current.status).toBe('conectada');
  });

  it('una conexión que falla pasa a error', async () => {
    const addTrackSpy = jest.spyOn(RTCPeerConnection.prototype, 'addTrack');
    const channel = createMemoryVideoSignalAdapter();
    const { result } = await renderHook(() => useVideoCall('s1', 'ana', 'bea', true, channel));
    await waitFor(() => expect(addTrackSpy).toHaveBeenCalled());
    const pc = addTrackSpy.mock.instances[0] as InstanceType<typeof RTCPeerConnection>;

    await act(async () => {
      (pc as unknown as { connectionState: string }).connectionState = 'failed';
      pc.onconnectionstatechange?.(new Event('connectionstatechange') as never);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('No se pudo conectar el vídeo.');
  });

  it('salir mientras se piden los permisos suelta la cámara que llegue después', async () => {
    let grant: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
      grant = resolve;
    });
    const real = mediaDevices.getUserMedia;
    let stream: Awaited<ReturnType<typeof real>> | null = null;
    jest
      .spyOn(mediaDevices, 'getUserMedia')
      .mockImplementationOnce(async (constraints: Parameters<typeof real>[0]) => {
        await pending;
        stream = await real(constraints);
        return stream;
      });
    const channel = createMemoryVideoSignalAdapter();
    const { result, rerender } = await renderHook(
      ({ active }: { active: boolean }) => useVideoCall('s1', 'ana', 'bea', active, channel),
      { initialProps: { active: true } }
    );

    await rerender({ active: false });
    await act(async () => {
      grant();
    });
    await flushMicrotasks();

    expect(stream!.getTracks().every((track) => (track as { stopped?: boolean }).stopped)).toBe(
      true
    );
    expect(result.current.localStream).toBeNull();
  });

  it('un ready repetido de la misma entrada no tira una llamada ya conectada', async () => {
    const addTrackSpy = jest.spyOn(RTCPeerConnection.prototype, 'addTrack');
    const channel = createMemoryVideoSignalAdapter();
    const send = jest.spyOn(channel, 'send');
    const { result } = await renderHook(() => ({
      ana: useVideoCall('s1', 'ana', 'bea', true, channel),
      bea: useVideoCall('s1', 'bea', 'ana', true, channel),
    }));
    await waitFor(() => expect(result.current.ana.status).toBe('conectada'));
    await waitFor(() => expect(result.current.bea.status).toBe('conectada'));
    const peers = addTrackSpy.mock.instances.length;

    const beaReady = send.mock.calls
      .map(([, message]) => message)
      .find((message) => message.from === 'bea' && message.kind === 'ready');
    await act(async () => {
      channel.send('s1', beaReady!);
    });
    await flushMicrotasks();

    expect(result.current.ana.status).toBe('conectada');
    expect(addTrackSpy.mock.instances.length).toBe(peers);
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
