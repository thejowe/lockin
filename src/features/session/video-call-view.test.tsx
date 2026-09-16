/**
 * `VideoCallView` contra el canal de señalización en memoria y el doble de
 * `react-native-webrtc` de `jest.setup.js` — mismo montaje que
 * `use-video-call.test.ts`, pero comprobando lo que se pinta, no el estado.
 *
 * Ojo: en RNTL 14 `render`/`fireEvent` son asíncronos.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { createMemoryVideoSignalAdapter } from '@/data';

import { VideoCallView } from './video-call-view';

describe('VideoCallView', () => {
  it('no pinta nada fuera de la ventana de la sesión', async () => {
    const { toJSON } = await render(
      <VideoCallView sessionId="s1" myProfileId="ana" counterpartId="bea" active={false} />
    );

    expect(toJSON()).toBeNull();
  });

  it('en cuanto está activa pinta los controles y un aviso mientras conecta', async () => {
    const channel = createMemoryVideoSignalAdapter();
    await render(
      <VideoCallView sessionId="s1" myProfileId="ana" counterpartId="bea" active channel={channel} />
    );

    expect(screen.getByText('Conectando…')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Silenciar micrófono' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Apagar cámara' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Colgar' })).toBeVisible();
    // Sin la otra parte al otro lado del canal, no hay stream remoto que pintar.
    expect(screen.queryByTestId('video-call-remote')).toBeNull();
  });

  it('pinta los dos RTCView cuando la llamada conecta de verdad', async () => {
    // Las dos partes tienen que montarse en el mismo árbol: sus efectos
    // corren en el mismo commit, antes de que la primera termine de mandar su
    // oferta (`getUserMedia` es async) — dos `render()` en serie dejarían a la
    // segunda unirse al canal tarde y perderse el mensaje de la primera, como
    // pasa con la presencia (sin cola, solo reenvío a quien ya está dentro).
    const channel = createMemoryVideoSignalAdapter();
    const both = await render(
      <>
        <VideoCallView sessionId="s1" myProfileId="ana" counterpartId="bea" active channel={channel} />
        <VideoCallView sessionId="s1" myProfileId="bea" counterpartId="ana" active channel={channel} />
      </>
    );

    await waitFor(() => expect(both.getAllByTestId('video-call-remote')).toHaveLength(2));
    expect(both.getAllByTestId('video-call-local')).toHaveLength(2);
  });

  it('silenciar/activar mic y cámara cambia la etiqueta del botón', async () => {
    const channel = createMemoryVideoSignalAdapter();
    await render(
      <VideoCallView sessionId="s1" myProfileId="ana" counterpartId="bea" active channel={channel} />
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Silenciar micrófono' }));
    expect(screen.getByRole('button', { name: 'Activar micrófono' })).toBeVisible();

    await fireEvent.press(screen.getByRole('button', { name: 'Apagar cámara' }));
    expect(screen.getByRole('button', { name: 'Activar cámara' })).toBeVisible();
  });

  it('colgar deja de pintar el vídeo sin desmontar el hueco', async () => {
    const channel = createMemoryVideoSignalAdapter();
    const both = await render(
      <>
        <VideoCallView sessionId="s1" myProfileId="ana" counterpartId="bea" active channel={channel} />
        <VideoCallView sessionId="s1" myProfileId="bea" counterpartId="ana" active channel={channel} />
      </>
    );
    await waitFor(() => expect(both.getAllByTestId('video-call-remote')).toHaveLength(2));

    await fireEvent.press(both.getAllByRole('button', { name: 'Colgar' })[0]);

    // Colgar por un lado manda `hangup` por el canal: el otro lado también
    // limpia su conexión, no se queda esperando a una llamada ya muerta.
    expect(both.queryAllByTestId('video-call-local')).toHaveLength(0);
    expect(both.queryAllByTestId('video-call-remote')).toHaveLength(0);
    expect(both.getAllByText('La videollamada empieza cuando entráis los dos.')).toHaveLength(2);
  });
});
