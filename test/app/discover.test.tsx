/**
 * Tests de la tab Descubrir.
 *
 * La pantalla solo compone, pero decide cuál de los cuatro estados del deck se
 * ve (cargando, error, tarjetas, vacío) y con qué modo se lee. Dos reglas suyas
 * no viven en `useDeck` y por eso se prueban aquí: que el deck se lea siempre
 * en modo cofundador, sin filtro ni cabecera (desde el 2026-10-12), y que un
 * fallo al guardar una decisión no borre el deck que ya está en pantalla — solo
 * avise.
 *
 * `SwipeDeck` se sustituye por un doble: su gesto ya está probado en
 * `swipe-deck.test.tsx`, y montarlo aquí arrastraría Reanimated sin aportar
 * nada sobre lo que esta pantalla decide.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { act } from 'react';

import { seedMockLikeEvents, setMockPremium } from '@/data/mock';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';

import { renderRoute, repositories, resetRepositories, resetRouter, router } from '../routes';

import DiscoverScreen from '../../src/app/(tabs)/discover';

import type { Decision, Profile } from '@/data';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

/** Lo último que recibió el doble de `SwipeDeck`. */
const mockDeck: {
  profiles: Profile[];
  decide: ((p: Profile, d: Decision) => void) | null;
  props: Record<string, unknown>;
} = {
  profiles: [],
  decide: null,
  props: {},
};

jest.mock('@/features/discover', () => {
  const actual = jest.requireActual('@/features/discover');
  const { Pressable, Text } = require('react-native');

  return {
    ...actual,
    SwipeDeck: (props: {
      profiles: Profile[];
      onDecide: (profile: Profile, decision: Decision) => void;
    }) => {
      const { profiles, onDecide } = props;
      mockDeck.profiles = profiles;
      mockDeck.decide = onDecide;
      mockDeck.props = props;
      return (
        <Pressable accessibilityRole="button" onPress={() => onDecide(profiles[0], 'pass')}>
          <Text>Deck de {profiles.length}</Text>
        </Pressable>
      );
    },
  };
});

/** Espera a que el deck haya resuelto y el doble esté en pantalla. */
async function renderDiscover() {
  const view = await renderRoute(<DiscoverScreen />);
  await waitFor(() => expect(screen.queryByText('Buscando perfiles…')).toBeNull());
  return view;
}

beforeEach(() => {
  mockDeck.profiles = [];
  mockDeck.decide = null;
  mockDeck.props = {};
  resetRepositories();
  resetRouter();
});

describe('DiscoverScreen', () => {
  it('solo enseña tarjetas: sin cabecera ni filtro de modo', async () => {
    await renderDiscover();

    expect(screen.queryByText('Quién está construyendo')).toBeNull();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByText(/Lock-In/)).toBeNull();
  });

  it('lee el deck en modo cofundador aunque la sesión guarde otro', async () => {
    const getDeck = jest.spyOn(repositories.discovery, 'getDeck');
    await repositories.session.setActiveMode('lockin');

    await renderDiscover();

    expect(getDeck).toHaveBeenCalledWith({ mode: 'par' });
    expect(mockDeck.profiles.every((profile) => profile.lookingFor !== 'lockin')).toBe(true);
  });

  it('con el deck agotado ofrece las salidas del vacío, no una tarjeta', async () => {
    jest.spyOn(repositories.discovery, 'getDeck').mockResolvedValue([]);

    await renderDiscover();

    expect(screen.getByText('Ya has visto a todo el mundo')).toBeTruthy();

    await fireEvent.press(screen.getByText('Ver mis matches'));
    expect(router.push).toHaveBeenCalledWith('/matches');
  });

  it('con el deck agotado, Premium puede deshacer la última decisión', async () => {
    setMockPremium(true);
    await repositories.discovery.recordDecision('seed-diego', 'pass');
    jest.spyOn(repositories.discovery, 'getDeck').mockResolvedValueOnce([]);

    await renderDiscover();
    expect(screen.getByText('Ya has visto a todo el mundo')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Deshacer' }));

    await waitFor(() => expect(screen.queryByText('Ya has visto a todo el mundo')).toBeNull());
    expect(mockDeck.profiles[0]?.id).toBe('seed-diego');
  });

  it('con el deck agotado y sin Premium no ofrece Deshacer', async () => {
    jest.spyOn(repositories.discovery, 'getDeck').mockResolvedValue([]);

    await renderDiscover();

    expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull();
  });

  it('si el deck no carga lo dice y deja reintentar', async () => {
    const getDeck = jest
      .spyOn(repositories.discovery, 'getDeck')
      .mockRejectedValue(new Error('sin red'));

    await renderDiscover();

    expect(screen.getByText('No hemos podido cargar el deck')).toBeTruthy();

    getDeck.mockResolvedValue([]);
    await fireEvent.press(screen.getByText('Reintentar'));

    await waitFor(() => expect(screen.getByText('Ya has visto a todo el mundo')).toBeTruthy());
  });

  it('si falla guardar una decisión avisa pero conserva el deck', async () => {
    jest
      .spyOn(repositories.discovery, 'recordDecision')
      .mockRejectedValue(new Error('no se ha podido guardar'));

    await renderDiscover();
    await fireEvent.press(screen.getByRole('button', { name: /Deck de/ }));

    await waitFor(() =>
      expect(
        screen.getByText('No hemos podido guardar tu última decisión. La tarjeta sigue en el deck.')
      ).toBeTruthy()
    );
    expect(screen.queryByText('No hemos podido cargar el deck')).toBeNull();
  });

  it('al hacer match, abrir el chat cierra el modal y navega a esa conversación', async () => {
    await renderDiscover();

    const reciprocal = mockDeck.profiles.find((profile) => profile.id === SEED_RECIPROCAL_IDS[0]);
    expect(reciprocal).toBeTruthy();

    await act(async () => {
      mockDeck.decide!(reciprocal!, 'like');
    });

    await waitFor(() => expect(screen.getByText('¡Match!')).toBeTruthy());

    await fireEvent.press(screen.getByText('Abrir chat'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/chat/[matchId]',
      params: { matchId: expect.any(String) },
    });
    expect(screen.queryByText('¡Match!')).toBeNull();
  });

  it('seguir descubriendo cierra el modal sin salir de la pantalla', async () => {
    await renderDiscover();

    const reciprocal = mockDeck.profiles.find((profile) => profile.id === SEED_RECIPROCAL_IDS[0]);

    await act(async () => {
      mockDeck.decide!(reciprocal!, 'like');
    });
    await waitFor(() => expect(screen.getByText('¡Match!')).toBeTruthy());

    await fireEvent.press(screen.getByText('Seguir descubriendo'));

    expect(screen.queryByText('¡Match!')).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });

  describe('Premium', () => {
    it('sin Premium y con el cupo agotado, frena el like del deck y lo dice', async () => {
      seedMockLikeEvents('like', 25, 1);
      await renderDiscover();
      await waitFor(() => expect(mockDeck.props.likeLocked).toBe(true));
      expect(mockDeck.props.likesLeft).toBe(0);

      await act(async () => {
        (mockDeck.props.onLikeLocked as () => void)();
      });

      await waitFor(() => expect(screen.getByText(/^Sin likes hasta las /)).toBeTruthy());
    });

    it('«Hazte Premium» cierra la hoja y abre el paywall', async () => {
      seedMockLikeEvents('like', 25, 1);
      await renderDiscover();
      await waitFor(() => expect(mockDeck.props.likeLocked).toBe(true));
      await act(async () => {
        (mockDeck.props.onLikeLocked as () => void)();
      });
      await waitFor(() => expect(screen.getByText('Hazte Premium')).toBeTruthy());

      await fireEvent.press(screen.getByText('Hazte Premium'));

      expect(router.push).toHaveBeenCalledWith('/premium');
      await waitFor(() => expect(screen.queryByText('Hazte Premium')).toBeNull());
    });

    it('con Premium, el deck recibe los cupos y no se frena', async () => {
      setMockPremium(true);
      await renderDiscover();

      await waitFor(() => expect(mockDeck.props.isPremium).toBe(true));
      expect(mockDeck.props.likeLocked).toBe(false);
      expect(mockDeck.props.likesLeft).toBeNull();
    });

    it('el Super Like del deck decide la tarjeta con la bandera super', async () => {
      const recordDecision = jest.spyOn(repositories.discovery, 'recordDecision');
      await renderDiscover();
      const top = mockDeck.profiles[0];

      await act(async () => {
        (mockDeck.props.onSuperLike as (profile: Profile) => void)(top);
      });

      expect(recordDecision).toHaveBeenCalledWith(top.id, 'like', 'par', { super: true });
    });

    it('deshacer y Boost del deck llegan al servidor', async () => {
      setMockPremium(true);
      const undo = jest.spyOn(repositories.premium, 'undoLastDecision');
      const boost = jest.spyOn(repositories.premium, 'activateBoost');
      await renderDiscover();

      await act(async () => {
        (mockDeck.props.onUndo as () => void)();
        (mockDeck.props.onBoost as () => void)();
      });

      expect(undo).toHaveBeenCalledTimes(1);
      expect(boost).toHaveBeenCalledTimes(1);
    });
  });
});
