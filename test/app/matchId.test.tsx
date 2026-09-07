/**
 * Tests de la conversación 1:1.
 *
 * Es la ruta con más decisiones propias de todo `app/`, y ninguna vive en
 * `useConversation`: qué se ve mientras carga, qué se ve si el id no resuelve,
 * cuándo sobran los icebreakers (en cuanto hay un mensaje), qué pasa al elegir
 * uno (se escribe en el campo, no se envía) y cuándo aparece un separador de
 * día. Cada una de ellas se puede romper sin que falle ningún otro test.
 *
 * El archivo se llama `matchId.test.tsx` y no `[matchId].test.tsx` a propósito:
 * los corchetes son sintaxis de rutas de `expo-router`, no de Jest, y un patrón
 * `-t` sobre ellos no encuentra nada.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { ScrollView } from 'react-native';

import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { CURRENT_USER_ID } from '@/data/mock';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';
import { buildProfileInput } from '@/data/test-fixtures';

import {
  renderRoute,
  repositories,
  resetRepositories,
  resetRouter,
  setSearchParams,
} from '../routes';

import ChatScreen from '../../src/app/chat/[matchId]';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

const COUNTERPART_ID = SEED_RECIPROCAL_IDS[0];

/** Crea un match real en el mock y devuelve su id y el perfil del otro lado. */
async function seedMatch() {
  await repositories.profiles.saveCurrent(buildProfileInput());
  const { match } = await repositories.discovery.recordDecision(COUNTERPART_ID, 'like');
  if (!match) throw new Error('El seed no ha generado match');

  const counterpart = await repositories.profiles.getById(COUNTERPART_ID);
  setSearchParams({ matchId: match.id });
  return { matchId: match.id, counterpart: counterpart! };
}

beforeEach(() => {
  resetRepositories();
  resetRouter();
  setSearchParams({});
});

describe('ChatScreen', () => {
  describe('cuando el id no resuelve', () => {
    it('lo explica en vez de dejar un hilo vacío', async () => {
      setSearchParams({ matchId: 'no-existe' });

      await renderRoute(<ChatScreen />);

      await waitFor(() =>
        expect(screen.getByText('Esta conversación no está disponible')).toBeTruthy()
      );
      expect(screen.getByText(/El match ya no existe/)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Volver a Matches' })).toBeTruthy();
    });

    it('si además ha fallado la carga, lo cuenta como fallo y no como match borrado', async () => {
      jest.spyOn(repositories.matches, 'getById').mockRejectedValue(new Error('sin red'));
      setSearchParams({ matchId: 'da-igual' });

      await renderRoute(<ChatScreen />);

      await waitFor(() => expect(screen.getByText(/Ha fallado la carga/)).toBeTruthy());
      expect(screen.queryByText(/El match ya no existe/)).toBeNull();
    });
  });

  describe('con la conversación abierta', () => {
    it('un `matchId` repetido en la URL se queda con el primero', async () => {
      const { matchId, counterpart } = await seedMatch();
      setSearchParams({ matchId: [matchId, 'otro'] });

      await renderRoute(<ChatScreen />);

      await waitFor(() => expect(screen.getByText(counterpart.name)).toBeTruthy());
    });

    it('pone arriba el hueco de Lock-In y presenta a la otra persona', async () => {
      const { counterpart } = await seedMatch();

      await renderRoute(<ChatScreen />);

      await waitFor(() => expect(screen.getByText(counterpart.name)).toBeTruthy());
      expect(screen.getByLabelText('Agendar sesión Lock-In')).toBeTruthy();
    });

    it('sin mensajes ofrece icebreakers', async () => {
      await seedMatch();

      await renderRoute(<ChatScreen />);

      await waitFor(() => expect(screen.getByText('Para romper el hielo')).toBeTruthy());
    });

    it('elegir un icebreaker lo escribe en el campo, no lo envía', async () => {
      const { matchId } = await seedMatch();

      await renderRoute(<ChatScreen />);
      await waitFor(() => expect(screen.getByText('Para romper el hielo')).toBeTruthy());

      const [chip] = screen.getAllByHintText(
        'Escribe esta frase en el campo de mensaje para que puedas editarla'
      );

      await fireEvent.press(chip);

      // Se vuelca en el campo, editable, y nada ha llegado al repositorio.
      expect(screen.getByLabelText('Mensaje').props.value).not.toBe('');
      await expect(repositories.messages.listByMatch(matchId)).resolves.toEqual([]);
    });

    it('el hilo se desplaza al final cuando le crece el contenido', async () => {
      // Sin esto, un mensaje nuevo aparece fuera de la pantalla y parece que no
      // se ha enviado. `onContentSizeChange` es el único disparador: no hay
      // efecto que reaccione a `messages`.
      const scrollToEnd = jest.spyOn(ScrollView.prototype, 'scrollToEnd');
      const { matchId } = await seedMatch();
      await repositories.messages.send({ matchId, body: 'Hola' });

      await renderRoute(<ChatScreen />);
      await waitFor(() => expect(screen.getByText('Hola')).toBeTruthy());
      scrollToEnd.mockClear();

      // `fireEvent` sube por el árbol hasta quien maneja el evento, así que
      // basta con lanzarlo desde una burbuja del hilo: RNTL 14 ya no trae las
      // consultas `UNSAFE_getByType` con las que se cogería el ScrollView.
      await fireEvent(screen.getByText('Hola'), 'contentSizeChange', 320, 900);

      expect(scrollToEnd).toHaveBeenCalledWith({ animated: true });
      scrollToEnd.mockRestore();
    });

    it('con mensajes ya escritos los icebreakers desaparecen', async () => {
      const { matchId } = await seedMatch();
      await repositories.messages.send({ matchId, body: 'Hola' });

      await renderRoute(<ChatScreen />);

      await waitFor(() => expect(screen.getByText('Hola')).toBeTruthy());
      expect(screen.queryByText('Para romper el hielo')).toBeNull();
    });

    it('el campo invita a escribir usando el nombre de pila', async () => {
      const { counterpart } = await seedMatch();

      await renderRoute(<ChatScreen />);

      const firstName = counterpart.name.split(' ')[0];
      await waitFor(() =>
        expect(screen.getByPlaceholderText(`Escribe a ${firstName}`)).toBeTruthy()
      );
    });

    it('enviar vacía el campo y añade el mensaje al hilo', async () => {
      const { matchId } = await seedMatch();

      await renderRoute(<ChatScreen />);
      await waitFor(() => expect(screen.getByLabelText('Mensaje')).toBeTruthy());

      await fireEvent.changeText(screen.getByLabelText('Mensaje'), 'Nos vemos el jueves');
      await fireEvent.press(screen.getByLabelText('Enviar mensaje'));

      await waitFor(() => expect(screen.getByText('Nos vemos el jueves')).toBeTruthy());
      expect(screen.getByLabelText('Mensaje').props.value).toBe('');
      await expect(repositories.messages.listByMatch(matchId)).resolves.toHaveLength(1);
    });

    it('si el envío falla lo dice y conserva el borrador', async () => {
      await seedMatch();
      jest.spyOn(repositories.messages, 'send').mockRejectedValue(new Error('sin red'));

      await renderRoute(<ChatScreen />);
      await waitFor(() => expect(screen.getByLabelText('Mensaje')).toBeTruthy());

      await fireEvent.changeText(screen.getByLabelText('Mensaje'), 'Nos vemos el jueves');
      await fireEvent.press(screen.getByLabelText('Enviar mensaje'));

      await waitFor(() =>
        expect(screen.getByText('No se ha podido enviar. Inténtalo otra vez.')).toBeTruthy()
      );
      expect(screen.getByLabelText('Mensaje').props.value).toBe('Nos vemos el jueves');
    });

    it('no separa el primer mensaje del día del match: la cabecera ya lo fecha', async () => {
      const { matchId } = await seedMatch();
      await repositories.messages.send({ matchId, body: 'Primero' });

      await renderRoute(<ChatScreen />);

      await waitFor(() => expect(screen.getByText('Primero')).toBeTruthy());
      expect(screen.queryByText('Hoy')).toBeNull();
    });

    it('separa por días en cuanto un mensaje cae en otro día que el anterior', async () => {
      const { matchId } = await seedMatch();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      jest.spyOn(repositories.messages, 'listByMatch').mockResolvedValue([
        {
          id: 'm-1',
          matchId,
          senderId: COUNTERPART_ID,
          body: 'Escrito ayer',
          sentAt: yesterday,
        },
        {
          id: 'm-2',
          matchId,
          senderId: CURRENT_USER_ID,
          body: 'Escrito hoy',
          sentAt: new Date().toISOString(),
        },
      ]);

      await renderRoute(<ChatScreen />);

      await waitFor(() => expect(screen.getByText('Escrito hoy')).toBeTruthy());
      expect(screen.getByText('Hoy')).toBeTruthy();
    });

    it('el emisor se decide contra el otro lado del match, no contra un id cableado', async () => {
      const { matchId } = await seedMatch();
      await repositories.messages.send({ matchId, body: 'Mío' });

      await renderRoute(<ChatScreen />);

      await waitFor(() => expect(screen.getByText('Mío')).toBeTruthy());
      const [message] = await repositories.messages.listByMatch(matchId);
      expect(message.senderId).toBe(CURRENT_USER_ID);
    });

    // Que el compositor siga alcanzable con el teclado abierto NO se comprueba
    // aquí, y no por descuido: el fallo es que Android 15+ con edge-to-edge no
    // redimensiona la ventana, y eso Jest no lo reproduce —`measureInWindow`
    // devuelve ceros, así que `KeyboardAvoidingView` nunca calcula solape—.
    // Un test de la prop `behavior` tampoco vale: RNTL 14 solo consulta
    // elementos host y afirmaría que el código dice "padding", no que el
    // teclado se esquiva. El guardián de esa regresión es `e2e/full-journey.yaml`
    // en emulador real. Ver `docs/plan/todo/chat.md`.
    //
    // Lo que sí se puede fijar sin emulador es la cuenta del offset que esta
    // pantalla le pasa al componente, con las medidas reales del emulador:
    // `src/features/chat/keyboard-offset.test.ts`.
  });
});
