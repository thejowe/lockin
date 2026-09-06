/**
 * Tests de la burbuja de conversación.
 *
 * Casi todo lo que hace es visual, pero una cosa sí es semántica y se puede
 * romper sin que nadie lo note: de qué lado cae la burbuja. Si `isMine` deja de
 * decidir la alineación, la conversación queda ilegible aunque los textos estén
 * bien. Eso, más que la burbuja pinte cuerpo y hora, es lo que se prueba aquí.
 */

import { StyleSheet } from 'react-native';

import { render, screen } from '@testing-library/react-native';

import { DayDivider, MessageBubble } from './message-bubble';

import type { Message } from '@/data';
import type { StyleProp, ViewStyle } from 'react-native';

function buildMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    matchId: 'match-1',
    senderId: 'them',
    body: 'Nos vemos el martes.',
    sentAt: new Date(2026, 2, 3, 9, 5).toISOString(),
    ...overrides,
  };
}

/** La alineación de la fila exterior: `flex-end` es mi lado, `flex-start` el suyo. */
function renderedAlignment(): ViewStyle['justifyContent'] {
  const root = screen.toJSON();
  if (root === null || Array.isArray(root)) throw new Error('Se esperaba una única raíz');
  return StyleSheet.flatten(root.props.style as StyleProp<ViewStyle>)?.justifyContent;
}

describe('MessageBubble', () => {
  it('pinta el cuerpo del mensaje', async () => {
    await render(<MessageBubble message={buildMessage()} isMine={false} />);

    expect(screen.getByText('Nos vemos el martes.')).toBeTruthy();
  });

  it('pinta la hora en reloj de 24 horas', async () => {
    await render(<MessageBubble message={buildMessage()} isMine={false} />);

    expect(screen.getByText('09:05')).toBeTruthy();
  });

  it('los mensajes propios se alinean a la derecha', async () => {
    await render(<MessageBubble message={buildMessage({ senderId: 'me' })} isMine />);

    expect(renderedAlignment()).toBe('flex-end');
  });

  it('los del otro lado se alinean a la izquierda', async () => {
    await render(<MessageBubble message={buildMessage()} isMine={false} />);

    expect(renderedAlignment()).toBe('flex-start');
  });

  it('el lado lo manda `isMine`, no el emisor del mensaje', async () => {
    // La pantalla deriva `isMine` comparando con el perfil del otro lado; la
    // burbuja obedece esa prop y no mira `senderId`.
    await render(<MessageBubble message={buildMessage({ senderId: 'them' })} isMine />);

    expect(renderedAlignment()).toBe('flex-end');
  });
});

describe('DayDivider', () => {
  it('pinta la etiqueta que le pasan', async () => {
    await render(<DayDivider label="Ayer" />);

    expect(screen.getByText('Ayer')).toBeTruthy();
  });
});
