/**
 * Tests de la cabecera de la conversación.
 *
 * Es el recordatorio de con quién se ha hecho match, y todo lo que pinta pasa
 * por un traductor: los enums de dominio (`diseno`, `manana`) se escriben en
 * castellano, la lista de especialidades se enumera con "y", y la fecha del
 * match se resume en un día. Cualquiera de esos tres puede romperse en silencio
 * y dejar un identificador crudo delante del usuario.
 *
 * Ojo: en RNTL 14 `render` es asíncrono.
 */

import { render, screen } from '@testing-library/react-native';

import { buildProfile } from '@/data/test-fixtures';

import { ConversationIntro } from './conversation-intro';

import type { MatchWithProfile } from '@/data';

function buildMatch(overrides: Partial<MatchWithProfile> = {}): MatchWithProfile {
  return {
    id: 'match-1',
    profileIds: ['me', 'them'],
    mode: 'par',
    createdAt: new Date().toISOString(),
    lastMessageAt: null,
    lastMessage: null,
    counterpart: buildProfile({
      id: 'them',
      name: 'Núria Bosch',
      location: 'Girona',
      avatar: { initials: 'NB', accent: 'teal' },
      specialties: ['diseno', 'producto'],
      availability: { hoursPerWeek: 15, bands: ['manana', 'noche'] },
    }),
    ...overrides,
  };
}

describe('ConversationIntro', () => {
  it('presenta a la otra persona con nombre e iniciales', async () => {
    await render(<ConversationIntro match={buildMatch()} />);

    expect(screen.getByText('Núria Bosch')).toBeTruthy();
    // El avatar se oculta a propósito del árbol de accesibilidad.
    expect(screen.getByText('NB', { includeHiddenElements: true })).toBeTruthy();
  });

  it('traduce las especialidades y las enumera con "y", no con comas sueltas', async () => {
    await render(<ConversationIntro match={buildMatch()} />);

    expect(screen.getByText('diseño y producto · Girona')).toBeTruthy();
  });

  it('con una sola especialidad no cuela una "y" de más', async () => {
    const match = buildMatch();
    match.counterpart.specialties = ['dev'];
    await render(<ConversationIntro match={match} />);

    expect(screen.getByText('desarrollo · Girona')).toBeTruthy();
  });

  it('escribe la disponibilidad en horas y franjas legibles', async () => {
    await render(<ConversationIntro match={buildMatch()} />);

    expect(screen.getByText('15 h/semana · por la mañana y noche')).toBeTruthy();
  });

  it.each([
    ['par', 'Match de Cofundador · Hoy'],
    ['lockin', 'Match de Lock-In · Hoy'],
  ] as const)('nombra el modo del match (%s) y lo fecha', async (mode, expected) => {
    await render(<ConversationIntro match={buildMatch({ mode })} />);

    expect(screen.getByText(expected)).toBeTruthy();
  });

  it('un match de ayer se fecha como "Ayer", no con el día de la semana', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await render(<ConversationIntro match={buildMatch({ createdAt: yesterday })} />);

    expect(screen.getByText('Match de Cofundador · Ayer')).toBeTruthy();
  });
});
