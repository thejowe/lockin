/**
 * Lo que necesita la pantalla del chat de un grupo, en una llamada: el grupo,
 * sus mensajes y el envío. Es el gemelo de `useConversation` (chat 1:1), con el
 * mismo filtro de contenido antes de enviar.
 */

import { useCallback, useEffect, useState } from 'react';

import { useQuery, useRepositories, type GroupMessage, type GroupView } from '@/data';
import {
  ObjectionableContentError,
  findObjectionableContent,
} from '@/features/safety/content-filter';

import { useMyGroup } from './use-my-group';

export interface GroupConversation {
  /** El grupo, o `null` si ya no estás en él (o el id no es el de tu grupo). */
  view: GroupView | null;
  messages: GroupMessage[];
  loading: boolean;
  error: Error | null;
  sendError: Error | null;
  sending: boolean;
  /** Envía el mensaje. Devuelve `false` si estaba vacío o si el envío falló. */
  send: (body: string) => Promise<boolean>;
}

export function useGroupConversation(groupId: string): GroupConversation {
  const repositories = useRepositories();
  const mine = useMyGroup();
  const messagesQuery = useQuery(`group-messages:${groupId}`, () =>
    repositories.groups.listMessages(groupId)
  );

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<Error | null>(null);
  const refreshMessages = messagesQuery.refresh;

  useEffect(
    () => repositories.groups.subscribeMessages(groupId, refreshMessages),
    [repositories, groupId, refreshMessages]
  );

  const send = useCallback(
    async (body: string): Promise<boolean> => {
      const trimmed = body.trim();
      if (trimmed.length === 0 || sending) return false;

      const kind = findObjectionableContent(trimmed);
      if (kind) {
        setSendError(new ObjectionableContentError(kind));
        return false;
      }

      setSending(true);
      setSendError(null);
      try {
        await repositories.groups.sendMessage(groupId, trimmed);
        return true;
      } catch (cause: unknown) {
        setSendError(cause instanceof Error ? cause : new Error(String(cause)));
        return false;
      } finally {
        setSending(false);
      }
    },
    [repositories, groupId, sending]
  );

  return {
    view: mine.group?.group.id === groupId ? mine.group : null,
    messages: messagesQuery.data ?? [],
    loading: mine.loading || messagesQuery.loading,
    error: mine.error ?? messagesQuery.error,
    sendError,
    sending,
    send,
  };
}
