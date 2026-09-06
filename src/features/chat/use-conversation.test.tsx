/**
 * Tests del estado de la conversación.
 *
 * `useConversation` junta tres lecturas y un envío. Lo que se guarda aquí es
 * sobre todo el envío: que recorte el texto, que rechace lo vacío sin llamar al
 * repositorio, que no permita dos envíos simultáneos, y que un fallo quede
 * expuesto en `sendError` sin tumbar la pantalla ni perder el hilo cargado.
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';

import { DataProvider } from '@/data';
import { createMockRepositories, CURRENT_USER_ID, resetState } from '@/data/mock';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';
import { buildProfileInput } from '@/data/test-fixtures';

import { useConversation } from './use-conversation';

import type { Repositories } from '@/data';

const COUNTERPART_ID = SEED_RECIPROCAL_IDS[0];

let repositories: Repositories;
let matchId: string;

function wrapper({ children }: { children: React.ReactNode }) {
  return <DataProvider value={repositories}>{children}</DataProvider>;
}

/** Monta el hook sobre `matchId` y espera a que la conversación esté resuelta. */
async function renderConversation(id: string = matchId) {
  const view = await renderHook(() => useConversation(id), { wrapper });
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
}

beforeEach(async () => {
  resetState();
  repositories = createMockRepositories();

  const result = await repositories.discovery.recordDecision(COUNTERPART_ID, 'like');
  if (!result.match) throw new Error('La semilla no generó match');
  matchId = result.match.id;
});

// Los repositorios mock son objetos de módulo: un `spyOn` sobrevive al test que
// lo puso. Restaurarlos aquí evita que un envío falseado contamine al siguiente.
afterEach(() => {
  jest.restoreAllMocks();
});

describe('useConversation', () => {
  it('resuelve el match, el hilo vacío y el perfil propio ausente', async () => {
    const { result } = await renderConversation();

    expect(result.current.match!.id).toBe(matchId);
    expect(result.current.match!.counterpart.id).toBe(COUNTERPART_ID);
    expect(result.current.messages).toEqual([]);
    expect(result.current.me).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.sendError).toBeNull();
  });

  it('expone el perfil propio cuando existe', async () => {
    const me = await repositories.profiles.saveCurrent(buildProfileInput({ name: 'Joel Torres' }));

    const { result } = await renderConversation();

    await waitFor(() => expect(result.current.me).not.toBeNull());
    expect(result.current.me!.id).toBe(me.id);
  });

  it('un match inexistente no es un error: el hilo queda vacío', async () => {
    const { result } = await renderConversation('match-que-no-existe');

    expect(result.current.match).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('envía el mensaje recortado y lo refleja en el hilo', async () => {
    const { result } = await renderConversation();

    let sent: boolean | undefined;
    await act(async () => {
      sent = await result.current.send('  ¿Nos vemos el martes?  ');
    });

    expect(sent).toBe(true);
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0].body).toBe('¿Nos vemos el martes?');
    expect(result.current.messages[0].senderId).toBe(CURRENT_USER_ID);
  });

  it('el envío actualiza también el match, no solo el hilo', async () => {
    const { result } = await renderConversation();
    expect(result.current.match!.lastMessage).toBeNull();

    await act(async () => {
      await result.current.send('Hola');
    });

    await waitFor(() => expect(result.current.match!.lastMessage).not.toBeNull());
    expect(result.current.match!.lastMessage!.body).toBe('Hola');
  });

  it('un mensaje solo de espacios no llega al repositorio', async () => {
    const send = jest.spyOn(repositories.messages, 'send');
    const { result } = await renderConversation();

    let sent: boolean | undefined;
    await act(async () => {
      sent = await result.current.send('    ');
    });

    expect(sent).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it('expone el fallo del envío y lo limpia al reintentar', async () => {
    const failure = new Error('Sin conexión.');
    const send = jest
      .spyOn(repositories.messages, 'send')
      .mockRejectedValueOnce(failure)
      .mockImplementationOnce(async ({ matchId: id, body }) => ({
        id: 'message-reintento',
        matchId: id,
        senderId: CURRENT_USER_ID,
        body,
        sentAt: new Date().toISOString(),
      }));

    const { result } = await renderConversation();

    let sent: boolean | undefined;
    await act(async () => {
      sent = await result.current.send('Hola');
    });

    expect(sent).toBe(false);
    expect(result.current.sendError).toBe(failure);
    expect(result.current.sending).toBe(false);

    await act(async () => {
      sent = await result.current.send('Hola');
    });

    expect(sent).toBe(true);
    expect(result.current.sendError).toBeNull();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('un rechazo que no es Error también acaba en sendError', async () => {
    jest.spyOn(repositories.messages, 'send').mockRejectedValue('caída del servidor');
    const { result } = await renderConversation();

    await act(async () => {
      await result.current.send('Hola');
    });

    expect(result.current.sendError).toBeInstanceOf(Error);
    expect(result.current.sendError!.message).toBe('caída del servidor');
  });

  it('expone el error si la carga del hilo falla', async () => {
    const failure = new Error('Sin conexión.');
    repositories = {
      ...repositories,
      messages: {
        ...repositories.messages,
        listByMatch: jest.fn().mockRejectedValue(failure),
      },
    };

    const { result } = await renderConversation();

    expect(result.current.error).toBe(failure);
    expect(result.current.messages).toEqual([]);
  });

  it('un mensaje del otro lado entra sin remontar', async () => {
    const { result } = await renderConversation();

    await act(async () => {
      await repositories.messages.send({ matchId, body: 'Llegado desde fuera' });
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0].body).toBe('Llegado desde fuera');
  });

  it('deja de escuchar el hilo al desmontarse', async () => {
    const listByMatch = jest.spyOn(repositories.messages, 'listByMatch');
    const { unmount } = await renderConversation();
    const callsWhileMounted = listByMatch.mock.calls.length;

    await act(async () => {
      unmount();
    });
    await repositories.messages.send({ matchId, body: 'Ya no hay nadie escuchando' });

    expect(listByMatch).toHaveBeenCalledTimes(callsWhileMounted);
  });
});
