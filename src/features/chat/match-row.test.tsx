/**
 * Tests de la fila de la lista de matches.
 *
 * La fila resume una conversación en una línea, y ese resumen tiene tres reglas
 * que sí se pueden romper en silencio: de quién es el último mensaje (el "Tú: "),
 * qué se lee cuando todavía no hay ninguno, y qué fecha manda — la del último
 * mensaje o, si no lo hay, la del match. Además es un destino de navegación, así
 * que su nombre accesible tiene que decir a dónde lleva.
 *
 * `expo-router` se sustituye por un `Link` que solo pinta a su hijo: montar el
 * router entero no aporta nada aquí y arrastra contexto de navegación que este
 * componente no usa.
 */

import { render, screen } from '@testing-library/react-native';

import { buildProfile } from '@/data/test-fixtures';

import { MatchRow, NO_MESSAGES_HINT } from './match-row';

import type { MatchWithProfile, Message } from '@/data';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const COUNTERPART = buildProfile({
  id: 'them',
  name: 'Núria Bosch',
  avatar: { initials: 'NB', accent: 'teal' },
});

/** Un ISO de hace `minutes` minutos: `formatRelative` lo escribe como "N min". */
function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function buildMatch(overrides: Partial<MatchWithProfile> = {}): MatchWithProfile {
  return {
    id: 'match-1',
    profileIds: ['me', 'them'],
    mode: 'par',
    createdAt: minutesAgo(30),
    lastMessageAt: null,
    counterpart: COUNTERPART,
    lastMessage: null,
    ...overrides,
  };
}

function buildMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    matchId: 'match-1',
    senderId: 'them',
    body: 'Te escribo mañana.',
    sentAt: minutesAgo(5),
    ...overrides,
  };
}

describe('MatchRow', () => {
  it('pinta el nombre y las iniciales del otro lado', async () => {
    await render(<MatchRow match={buildMatch()} />);

    expect(screen.getByText('Núria Bosch')).toBeTruthy();
    expect(screen.getByText('NB')).toBeTruthy();
  });

  it('nombra el modo bajo el que nació el match', async () => {
    await render(<MatchRow match={buildMatch({ mode: 'par' })} />);
    expect(screen.getByText('Cofundador')).toBeTruthy();

    await render(<MatchRow match={buildMatch({ mode: 'lockin' })} />);
    expect(screen.getByText('Lock-In')).toBeTruthy();
  });

  describe('sin mensajes todavía', () => {
    it('empuja al primer Lock-In en lugar de dejar el hueco vacío', async () => {
      await render(<MatchRow match={buildMatch()} />);

      expect(screen.getByText(NO_MESSAGES_HINT)).toBeTruthy();
    });

    it('se marca como nuevo', async () => {
      await render(<MatchRow match={buildMatch()} />);

      expect(screen.getByText('· Nuevo')).toBeTruthy();
    });

    it('fecha el match, que es lo único que ha pasado', async () => {
      await render(<MatchRow match={buildMatch({ createdAt: minutesAgo(30) })} />);

      expect(screen.getByText('30 min')).toBeTruthy();
    });
  });

  describe('con último mensaje', () => {
    it('muestra su texto tal cual si lo escribió el otro', async () => {
      await render(<MatchRow match={buildMatch({ lastMessage: buildMessage() })} />);

      expect(screen.getByText('Te escribo mañana.')).toBeTruthy();
    });

    it('lo prefija con "Tú: " si lo escribí yo', async () => {
      const lastMessage = buildMessage({ senderId: 'me' });
      await render(<MatchRow match={buildMatch({ lastMessage })} />);

      expect(screen.getByText('Tú: Te escribo mañana.')).toBeTruthy();
    });

    it('deja de marcarse como nuevo', async () => {
      await render(<MatchRow match={buildMatch({ lastMessage: buildMessage() })} />);

      expect(screen.queryByText('· Nuevo')).toBeNull();
    });

    it('la fecha pasa a ser la del mensaje, no la del match', async () => {
      const match = buildMatch({
        createdAt: minutesAgo(30),
        lastMessage: buildMessage({ sentAt: minutesAgo(5) }),
      });
      await render(<MatchRow match={match} />);

      expect(screen.getByText('5 min')).toBeTruthy();
      expect(screen.queryByText('30 min')).toBeNull();
    });
  });

  describe('nombre accesible', () => {
    it('dice con quién es la conversación y por dónde va', async () => {
      await render(<MatchRow match={buildMatch({ lastMessage: buildMessage() })} />);

      expect(
        screen.getByLabelText('Conversación con Núria Bosch. Te escribo mañana.')
      ).toBeTruthy();
    });

    it('sin mensajes anuncia la misma pista que se lee', async () => {
      await render(<MatchRow match={buildMatch()} />);

      expect(
        screen.getByLabelText(`Conversación con Núria Bosch. ${NO_MESSAGES_HINT}`)
      ).toBeTruthy();
    });
  });
});
