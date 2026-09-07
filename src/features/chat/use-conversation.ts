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

  // Enviar un mensaje relee el hilo y el match, y `useQuery` publica
  // `data: null, loading: true` en cuanto arranca la relectura — antes de tener
  // el dato nuevo. Sin retener el anterior, la pantalla cae en su rama
  // `loading && !match` y remonta el árbol entero: el compositor se desmonta
  // con el teclado abierto, Android lo cierra al perder el `TextInput`, y el
  // recorrido E2E se sale del chat en el `hideKeyboard` siguiente. Se vio en el
  // run 34160309273; ver `docs/plan/todo/chat.md`.
  //
  // Esto no arregla `useQuery`, que le hace lo mismo a Descubrir, Matches y
  // Perfil: eso es de `arquitecto` y queda anotado en ese TODO.
  const match = useResolvedOrPrevious(matchQuery.data, matchQuery.loading);
  const messages = useResolvedOrPrevious(messagesQuery.data, messagesQuery.loading);

  return {
    match,
    messages: messages ?? [],
    me: meQuery.data,
    loading: matchQuery.loading || messagesQuery.loading,
    error: matchQuery.error ?? messagesQuery.error,
    sendError,
    sending,
    send,
  };
}

/**
 * El último valor resuelto mientras se relee.
 *
 * Solo retiene durante `loading`: en cuanto la consulta resuelve, manda lo que
 * traiga — incluido `null`. Así un match que de verdad ha desaparecido sigue
 * apareciendo como desaparecido, y solo se tapa el hueco de la relectura.
 *
 * El valor se guarda ajustando estado durante el render, no en un `useEffect`:
 * un efecto llegaría un render tarde, y ese render tardío es exactamente el que
 * desmonta el compositor y cierra el teclado. React vuelve a renderizar sin
 * pintar el intermedio, así que no hay parpadeo. Con una ref no se puede: el
 * lint lo prohíbe, y con razón —leer o escribir `current` en render se salta al
 * compilador de React—.
 */
function useResolvedOrPrevious<T>(data: T | null, loading: boolean): T | null {
  const [lastResolved, setLastResolved] = useState<T | null>(null);

  if (!loading) {
    if (lastResolved !== data) {
      setLastResolved(data);
    }

    return data;
  }

  return lastResolved;
}
