/**
 * Tests del modal de match.
 *
 * Interrumpe el swipe, así que las dos cosas que no pueden fallar son que solo
 * aparezca cuando hay un match que celebrar y que sus dos salidas devuelvan al
 * sitio correcto: la principal al chat de ESE match, la secundaria al deck.
 * También se comprueba `onRequestClose`, que es como Android cierra el modal
 * con el botón atrás y no tiene ningún elemento que pulsar.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { buildProfile } from '@/data/test-fixtures';

import { MatchModal } from './match-modal';

import type { MatchEvent } from './use-deck';

import type { Specialty } from '@/data';

const PROFILE = buildProfile({
  id: 'them',
  name: 'Núria Bosch',
  avatar: { initials: 'NB', accent: 'teal' },
  lookingFor: 'par',
  specialties: ['dev'],
  seekingSpecialties: ['marketing', 'ventas'],
});

function buildEvent(overrides: Partial<MatchEvent['match']> = {}): MatchEvent {
  return {
    match: {
      id: 'match-1',
      profileIds: ['me', 'them'],
      mode: 'par',
      createdAt: '2026-03-03T10:00:00.000Z',
      lastMessageAt: null,
      ...overrides,
    },
    profile: PROFILE,
  };
}

function setup(event: MatchEvent | null, viewerSpecialties: Specialty[] = []) {
  const onOpenChat = jest.fn();
  const onDismiss = jest.fn();
  return {
    onOpenChat,
    onDismiss,
    ui: (
      <MatchModal
        event={event}
        onOpenChat={onOpenChat}
        onDismiss={onDismiss}
        viewerSpecialties={viewerSpecialties}
      />
    ),
  };
}

describe('MatchModal', () => {
  describe('sin match', () => {
    it('no pinta nada: el deck se ve entero', async () => {
      const { ui } = setup(null);
      await render(ui);

      expect(screen.queryByText('¡Match!')).toBeNull();
      expect(screen.queryByText('Abrir chat')).toBeNull();
    });
  });

  describe('con match', () => {
    it('celebra el match y nombra a la otra persona', async () => {
      const { ui } = setup(buildEvent());
      await render(ui);

      expect(screen.getByText('¡Match!')).toBeTruthy();
      expect(screen.getByText(/Núria Bosch ya te había dado like/)).toBeTruthy();
      // El avatar se oculta a propósito del árbol de accesibilidad (el nombre
      // ya sale al lado), así que hay que pedirlo explícitamente.
      expect(screen.getByText('NB', { includeHiddenElements: true })).toBeTruthy();
    });

    it.each([
      ['par', 'Modo Cofundador'],
      ['lockin', 'Modo Compañero de Lock-In'],
    ] as const)('dice bajo qué modo nació el match (%s)', async (mode, heading) => {
      const { ui } = setup(buildEvent({ mode }));
      await render(ui);

      expect(screen.getByText(heading)).toBeTruthy();
    });

    it('la acción principal abre el chat de ese match, no otro', async () => {
      const { onOpenChat, onDismiss, ui } = setup(buildEvent({ id: 'match-42' }));
      await render(ui);

      await fireEvent.press(screen.getByText('Abrir chat'));

      expect(onOpenChat).toHaveBeenCalledWith('match-42');
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('la secundaria devuelve al deck sin abrir nada', async () => {
      const { onOpenChat, onDismiss, ui } = setup(buildEvent());
      await render(ui);

      await fireEvent.press(screen.getByText('Seguir descubriendo'));

      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(onOpenChat).not.toHaveBeenCalled();
    });

    it('nombra el encaje cuando la otra persona busca lo que uno domina', async () => {
      const { ui } = setup(buildEvent(), ['marketing', 'ventas']);
      await render(ui);

      expect(screen.getByText(/busca justo lo que tú dominas: Marketing y Ventas/)).toBeTruthy();
    });

    it('sin encaje no dice nada: el match no se adorna con algo que no hay', async () => {
      const { ui } = setup(buildEvent(), ['legal']);
      await render(ui);

      expect(screen.queryByText(/busca justo lo que tú dominas/)).toBeNull();
    });

    it('el botón atrás de Android cierra el modal, no la pantalla de debajo', async () => {
      const { onDismiss, ui } = setup(buildEvent());
      await render(ui);

      await fireEvent(screen.getByText('¡Match!'), 'requestClose');

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });
});
