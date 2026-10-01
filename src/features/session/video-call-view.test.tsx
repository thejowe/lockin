/**
 * `VideoCallView` contra el canal de señalización en memoria y el doble de
 * `react-native-webrtc` de `jest.setup.js` — mismo montaje que
 * `use-video-call.test.ts`, pero comprobando lo que se pinta, no el estado.
 *
 * Ojo: en RNTL 14 `render`/`fireEvent` son asíncronos.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { mediaDevices } from 'react-native-webrtc';

import { Spacing } from '@/constants/theme';
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
      <VideoCallView
        sessionId="s1"
        myProfileId="ana"
        counterpartId="bea"
        active
        channel={channel}
      />
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
        <VideoCallView
          sessionId="s1"
          myProfileId="ana"
          counterpartId="bea"
          active
          channel={channel}
        />
        <VideoCallView
          sessionId="s1"
          myProfileId="bea"
          counterpartId="ana"
          active
          channel={channel}
        />
      </>
    );

    await waitFor(() => expect(both.getAllByTestId('video-call-remote')).toHaveLength(2));
    expect(both.getAllByTestId('video-call-local')).toHaveLength(2);
  });

  it('silenciar/activar mic y cámara cambia la etiqueta del botón', async () => {
    const channel = createMemoryVideoSignalAdapter();
    await render(
      <VideoCallView
        sessionId="s1"
        myProfileId="ana"
        counterpartId="bea"
        active
        channel={channel}
      />
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
        <VideoCallView
          sessionId="s1"
          myProfileId="ana"
          counterpartId="bea"
          active
          channel={channel}
        />
        <VideoCallView
          sessionId="s1"
          myProfileId="bea"
          counterpartId="ana"
          active
          channel={channel}
        />
      </>
    );
    await waitFor(() => expect(both.getAllByTestId('video-call-remote')).toHaveLength(2));

    await fireEvent.press(both.getAllByRole('button', { name: 'Colgar' })[0]);

    // Colgar por un lado manda `hangup` por el canal: el otro lado tira la
    // conexión muerta —sin vídeo remoto congelado— pero se queda con su cámara
    // esperando, para que volver a entrar levante la llamada otra vez (spec §6).
    expect(both.queryAllByTestId('video-call-remote')).toHaveLength(0);
    expect(both.getAllByTestId('video-call-local')).toHaveLength(1);
    expect(both.getByText('La videollamada empieza cuando entráis los dos.')).toBeTruthy();
    expect(both.getByText('Conectando…')).toBeTruthy();
  });

  it('los controles caben en la vista: van de borde a borde, centrados, y saltan de línea antes que salirse', async () => {
    const channel = createMemoryVideoSignalAdapter();
    await render(
      <VideoCallView
        sessionId="s1"
        myProfileId="ana"
        counterpartId="bea"
        active
        channel={channel}
      />
    );

    // En el emulador (412 dp) la fila absoluta no tenía ni `left` ni `right`
    // y se cortaba por los dos lados.
    const style = StyleSheet.flatten(screen.getByTestId('video-call-controls').props.style);
    expect(style).toMatchObject({
      position: 'absolute',
      left: Spacing.two,
      right: Spacing.two,
      flexWrap: 'wrap',
      justifyContent: 'center',
    });
    // En pantalla, el texto corto; para el lector de pantalla, la acción entera.
    expect(screen.getByRole('button', { name: 'Silenciar micrófono' })).toHaveTextContent(
      'Silenciar'
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Silenciar micrófono' }));
    expect(screen.getByRole('button', { name: 'Activar micrófono' })).toHaveTextContent(
      'Activar mic'
    );
  });

  it('el aviso no se mete debajo de la miniatura propia', async () => {
    const channel = createMemoryVideoSignalAdapter();
    const both = await render(
      <>
        <VideoCallView
          sessionId="s1"
          myProfileId="ana"
          counterpartId="bea"
          active
          channel={channel}
        />
        <VideoCallView
          sessionId="s1"
          myProfileId="bea"
          counterpartId="ana"
          active
          channel={channel}
        />
      </>
    );
    await waitFor(() => expect(both.getAllByTestId('video-call-remote')).toHaveLength(2));
    await fireEvent.press(both.getAllByRole('button', { name: 'Colgar' })[0]);

    // El lado que sigue esperando tiene su cámara arriba a la derecha y un aviso.
    const status = both
      .getAllByTestId('video-call-status')
      .find((node) => node.props.children === 'Conectando…');
    const padding = StyleSheet.flatten(status?.props.style).paddingHorizontal as number;
    expect(both.getAllByTestId('video-call-local')).toHaveLength(1);
    // La miniatura mide 96 de ancho y va a `Spacing.two` del borde.
    expect(padding).toBeGreaterThanOrEqual(96 + Spacing.two);
  });

  it('permiso de cámara/micrófono denegado pinta el aviso de error sin crashear', async () => {
    jest.spyOn(mediaDevices, 'getUserMedia').mockRejectedValueOnce(new Error('NotAllowedError'));
    const channel = createMemoryVideoSignalAdapter();

    await render(
      <VideoCallView
        sessionId="s1"
        myProfileId="ana"
        counterpartId="bea"
        active
        channel={channel}
      />
    );

    expect(await screen.findByText('No se pudo acceder a la cámara o al micrófono.')).toBeVisible();
    // El resto del hueco (controles) sigue ahí: un fallo de vídeo no se lleva
    // por delante el resto de la sesión.
    expect(screen.getByRole('button', { name: 'Colgar' })).toBeVisible();
    expect(screen.queryByTestId('video-call-remote')).toBeNull();
  });
});
