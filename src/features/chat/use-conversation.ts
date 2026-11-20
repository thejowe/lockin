/**
 * Todo lo que necesita la pantalla de conversación, en una sola llamada.
 *
 * Junta tres lecturas (el match, sus mensajes y el perfil propio) para que la
 * pantalla no tenga que orquestar tres estados de carga. El perfil propio se
 * carga porque los icebreakers se generan comparando los dos perfiles; si aún no
 * existe, las reglas se apañan solo con el del otro lado.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  useQuery,
  useRepositories,
  type MatchWithProfile,
  type Message,
  type Profile,
} from '@/data';

import { useLastGood } from './use-last-good';

export interface Conversation {
  match: MatchWithProfile | null;
  messages: Message[];
  /** Perfil propio, o `null` si todavía no se ha completado el onboarding. */
  me: Profile | null;
  /** Cierto hasta que el match y sus mensajes están resueltos. */
  loading: boolean;
  /** Fallo al cargar la conversación. */
  error: Error | null;
  /** Fallo del último envío. Se limpia al reintentar. */
  sendError: Error | null;
  sending: boolean;
  /** Envía el mensaje. Devuelve `false` si estaba vacío o si el envío falló. */
  send: (body: string) => Promise<boolean>;
}

export function useConversation(matchId: string): Conversation {
  const repositories = useRepositories();

  const matchQuery = useQuery(`match:${matchId}`, () => repositories.matches.getById(matchId));
  const messagesQuery = useQuery(`messages:${matchId}`, () =>
    repositories.messages.listByMatch(matchId)
  );
  const meQuery = useQuery('profile:current', () => repositories.profiles.getCurrent());

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<Error | null>(null);

  const refreshMessages = messagesQuery.refresh;
  const refreshMatch = matchQuery.refresh;

  // Un mensaje nuevo cambia el hilo y también el `lastMessage` del match.
  useEffect(
    () =>
      repositories.messages.subscribe(matchId, () => {
        refreshMessages();
        refreshMatch();
      }),
    [repositories, matchId, refreshMessages, refreshMatch]
  );

  const send = useCallback(
    async (body: string): Promise<boolean> => {
      const trimmed = body.trim();
      if (trimmed.length === 0 || sending) return false;

      setSending(true);
      setSendError(null);
      try {
        await repositories.messages.send({ matchId, body: trimmed });
        return true;
      } catch (cause: unknown) {
        setSendError(cause instanceof Error ? cause : new Error(String(cause)));
        return false;
      } finally {
        setSending(false);
      }
    },
    [repositories, matchId, sending]
  );

  // Enviar un mensaje relee el hilo y el match. `useQuery` retiene el dato
  // anterior mientras relee, así que la pantalla no cae en su rama
  // `loading && !match` ni remonta el árbol: el compositor se quedaba sin
  // montar con el teclado abierto, Android lo cerraba al perder el `TextInput`,
  // y el recorrido E2E se salía del chat en el `hideKeyboard` siguiente. Se vio
  // en el run 34160309273; ver `docs/plan/todo/chat.md`.
  // Un corte de red en una relectura (el chat sondea cada 15 s) no tira la
  // conversación ni lo que se está escribiendo; un match que ya no existe, sí.
  const match = useLastGood(matchQuery, `match:${matchId}`);
  const messages = useLastGood(messagesQuery, `messages:${matchId}`);
  return {
    match: match.data,
    messages: messages.data ?? [],
    me: meQuery.data,
    loading: match.loading || messages.loading,
    error: matchQuery.error ?? messagesQuery.error,
    sendError,
    sending,
    send,
  };
}
