/**
 * Tests del estado del deck de descubrimiento.
 *
 * `useDeck` es donde el swipe se convierte en decisión: descarta la tarjeta en
 * local antes de que responda el repositorio, la devuelve al deck si el guardado
 * falla y descarta lo decidido al cambiar de modo. Son tres reglas fáciles de
 * romper en un refactor y difíciles de ver a ojo en el simulador.
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';

import { DataProvider, QuotaExceededError } from '@/data';
import {
  createMockRepositories,
  CURRENT_USER_ID,
  resetState,
  seedMockLikeEvents,
  setMockPremium,
} from '@/data/mock';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';
import { buildProfileInput } from '@/data/test-fixtures';

import { useDeck } from './use-deck';

import type { ModePreference, Profile, Repositories } from '@/data';

const RECIPROCAL_ID = SEED_RECIPROCAL_IDS[0];

let repositories: Repositories;

function wrapper({ children }: { children: React.ReactNode }) {
  return <DataProvider value={repositories}>{children}</DataProvider>;
}

/** Monta el hook y espera a que el primer deck esté cargado. */
async function renderDeck(mode: ModePreference = 'ambos') {
  const view = await renderHook((props: { mode: ModePreference }) => useDeck(props.mode), {
    initialProps: { mode },
    wrapper,
  });

  await waitFor(() => expect(view.result.current.cards).not.toBeNull());
  return view;
}

/** La tarjeta del deck con ese id, o falla el test si no está. */
function cardWithId(cards: Profile[] | null, id: string): Profile {
  const card = cards?.find((profile) => profile.id === id);
  if (!card) throw new Error(`El deck no contiene ${id}`);
  return card;
}

beforeEach(() => {
  resetState();
  repositories = createMockRepositories();
});

describe('useDeck', () => {
  it('deja de cargar sin error una vez resuelto el deck', async () => {
    const { result } = await renderDeck();

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.match).toBeNull();
  });

  it('carga el deck del modo pedido', async () => {
    const { result } = await renderDeck('par');

    expect(result.current.loading).toBe(false);
    expect(result.current.cards!.length).toBeGreaterThan(0);
    expect(result.current.cards!.every((profile) => profile.lookingFor !== 'lockin')).toBe(true);
    expect(result.current.cards!.map((profile) => profile.id)).not.toContain(CURRENT_USER_ID);
  });

  it('quita la tarjeta del deck en cuanto se decide, sin esperar al repositorio', async () => {
    const { result } = await renderDeck();
    const target = result.current.cards![0];

    await act(async () => {
      result.current.decide(target, 'pass');
    });

    expect(result.current.cards!.map((profile) => profile.id)).not.toContain(target.id);
  });

  it('expone el match cuando el like es recíproco y lo deja descartar', async () => {
    const { result } = await renderDeck();
    const target = cardWithId(result.current.cards, RECIPROCAL_ID);

    await act(async () => {
      result.current.decide(target, 'like');
    });

    await waitFor(() => expect(result.current.match).not.toBeNull());
    expect(result.current.match!.profile.id).toBe(RECIPROCAL_ID);
    expect(result.current.match!.match.profileIds).toContain(RECIPROCAL_ID);

    await act(async () => {
      result.current.dismissMatch();
    });

    expect(result.current.match).toBeNull();
  });

  it('el match nace en el modo del deck, no en el activo de la sesión', async () => {
    // El caso del comprobador (2026-09-29): onboarding «Cofundador», chip
    // Lock-In, like a Alba, que busca compañero de Lock-In. Antes salía Par.
    await repositories.session.setActiveMode('par');
    const { result } = await renderDeck('lockin');
    const alba = cardWithId(result.current.cards, 'seed-alba');

    await act(async () => {
      result.current.decide(alba, 'like');
    });

    await waitFor(() => expect(result.current.match).not.toBeNull());
    expect(result.current.match!.match.mode).toBe('lockin');
  });

  it('un like sin reciprocidad no levanta el modal de match', async () => {
    const { result } = await renderDeck();
    const target = cardWithId(result.current.cards, 'seed-diego');

    await act(async () => {
      result.current.decide(target, 'like');
    });

    await waitFor(() => expect(result.current.cards).not.toContain(target));
    expect(result.current.match).toBeNull();
  });

  it('devuelve la tarjeta al deck y expone el error si el guardado falla', async () => {
    const failure = new Error('Sin conexión.');
    repositories = {
      ...repositories,
      discovery: {
        ...repositories.discovery,
        recordDecision: jest.fn().mockRejectedValue(failure),
      },
    };

    const { result } = await renderDeck();
    const target = result.current.cards![0];

    await act(async () => {
      result.current.decide(target, 'like');
    });

    await waitFor(() => expect(result.current.error).toBe(failure));
    expect(result.current.cards!.map((profile) => profile.id)).toContain(target.id);
  });

  it('al cambiar de modo relee el deck y olvida lo decidido con el anterior', async () => {
    const { result, rerender } = await renderDeck('par');
    const target = result.current.cards![0];

    await act(async () => {
      result.current.decide(target, 'pass');
    });
    expect(result.current.cards!.map((profile) => profile.id)).not.toContain(target.id);

    await rerender({ mode: 'lockin' });
    await waitFor(() => expect(result.current.cards).not.toBeNull());

    // El deck nuevo se filtra solo por el repositorio: lo decidido ya está
    // persistido, así que la tarjeta no vuelve por la puerta de atrás.
    expect(result.current.cards!.every((profile) => profile.lookingFor !== 'par')).toBe(true);
    expect(result.current.cards!.map((profile) => profile.id)).not.toContain(target.id);
  });

  it('refresh vuelve a pedir el deck', async () => {
    const getDeck = jest.spyOn(repositories.discovery, 'getDeck');
    const { result } = await renderDeck();

    expect(getDeck).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => expect(getDeck).toHaveBeenCalledTimes(2));
  });

  describe('Premium', () => {
    it('con el cupo agotado, el like no descarta la tarjeta y abre la hoja', async () => {
      seedMockLikeEvents('like', 25, 1);
      const { result } = await renderDeck('par');
      const target = result.current.cards![0];

      await act(async () => {
        result.current.decide(target, 'like');
      });

      await waitFor(() => expect(result.current.blocked).not.toBeNull());
      expect(result.current.blocked).toMatchObject({ kind: 'likes' });
      expect((result.current.blocked as { resetsAt: string }).resetsAt).toEqual(expect.any(String));
      // La carta sigue siendo la de arriba y el fallo no se cuenta como error de guardado.
      expect(result.current.cards![0].id).toBe(target.id);
      expect(result.current.error).toBeNull();
    });

    it('cerrar la hoja la deja en null', async () => {
      seedMockLikeEvents('like', 25, 1);
      const { result } = await renderDeck('par');

      await act(async () => {
        result.current.decide(result.current.cards![0], 'like');
      });
      await waitFor(() => expect(result.current.blocked).not.toBeNull());

      await act(async () => {
        result.current.dismissBlocked();
      });

      expect(result.current.blocked).toBeNull();
    });

    it('expone los cupos para que la pantalla sepa cuándo frenar el gesto', async () => {
      seedMockLikeEvents('like', 25, 1);
      const { result } = await renderDeck('par');

      await waitFor(() => expect(result.current.quotas?.likesLeft).toBe(0));
    });

    it('el Super Like manda la bandera super y descarta la tarjeta', async () => {
      const recordDecision = jest.spyOn(repositories.discovery, 'recordDecision');
      const { result } = await renderDeck('par');
      const target = result.current.cards![0];

      await act(async () => {
        result.current.superLike(target.id);
      });

      expect(recordDecision).toHaveBeenCalledWith(target.id, 'like', 'par', { super: true });
      expect(result.current.cards!.map((profile) => profile.id)).not.toContain(target.id);
    });

    it('el segundo Super Like de la semana abre la hoja y devuelve la tarjeta', async () => {
      const { result } = await renderDeck('par');
      const [first, second] = result.current.cards!;

      await act(async () => {
        result.current.superLike(first.id);
      });
      await act(async () => {
        result.current.superLike(second.id);
      });

      await waitFor(() => expect(result.current.blocked).toMatchObject({ kind: 'supers' }));
      expect(result.current.cards![0].id).toBe(second.id);
    });

    it('con Premium, deshacer devuelve la carta arriba del deck', async () => {
      setMockPremium(true);
      const { result } = await renderDeck('par');
      const target = result.current.cards![0];

      await act(async () => {
        result.current.decide(target, 'pass');
      });
      expect(result.current.cards![0].id).not.toBe(target.id);

      let restored: string | null = null;
      await act(async () => {
        restored = await result.current.undo();
      });

      expect(restored).toBe(target.id);
      expect(result.current.cards![0].id).toBe(target.id);
      expect(result.current.blocked).toBeNull();
    });

    it('si no hay nada que deshacer, el deck no cambia', async () => {
      setMockPremium(true);
      const { result } = await renderDeck('par');
      const before = result.current.cards!.map((profile) => profile.id);

      let restored: string | null = 'x';
      await act(async () => {
        restored = await result.current.undo();
      });

      expect(restored).toBeNull();
      expect(result.current.cards!.map((profile) => profile.id)).toEqual(before);
    });

    it('con Premium, el Boost devuelve cuándo termina', async () => {
      setMockPremium(true);
      const { result } = await renderDeck('par');

      let endsAt: string | null = null;
      await act(async () => {
        endsAt = await result.current.boost();
      });

      expect(Date.parse(endsAt!)).toBeGreaterThan(0);
      expect(result.current.blocked).toBeNull();
    });

    it('sin Premium, el Boost abre la hoja de Premium', async () => {
      const { result } = await renderDeck('par');

      await act(async () => {
        await result.current.boost();
      });

      expect(result.current.blocked).toBe('premium');
    });

    it('comprobar el límite con el cupo agotado abre la hoja con la hora del servidor', async () => {
      seedMockLikeEvents('like', 25, 1);
      const { result } = await renderDeck('par');

      await act(async () => {
        await result.current.checkLikeLimit();
      });

      expect(result.current.blocked).toMatchObject({ kind: 'likes' });
    });

    it('comprobar el límite con cupo liberado no abre nada', async () => {
      const { result } = await renderDeck('par');

      await act(async () => {
        await result.current.checkLikeLimit();
      });

      expect(result.current.blocked).toBeNull();
    });

    it('sin Premium, deshacer abre la hoja de Premium', async () => {
      const { result } = await renderDeck('par');

      await act(async () => {
        await result.current.undo();
      });

      expect(result.current.blocked).toBe('premium');
    });

    it('al refrescar, la carta deshecha se reconcilia con lo que devuelve el servidor', async () => {
      setMockPremium(true);
      const { result } = await renderDeck('par');
      const target = result.current.cards![0];

      await act(async () => {
        result.current.decide(target, 'pass');
      });
      await act(async () => {
        await result.current.undo();
      });
      await waitFor(() => expect(result.current.cards![0].id).toBe(target.id));

      // Tras bloquearla, una relectura no puede mantenerla arriba por su copia vieja.
      await repositories.profiles.saveCurrent(buildProfileInput());
      await repositories.profiles.block(target.id);
      await act(async () => {
        result.current.refresh();
      });

      await waitFor(() =>
        expect(result.current.cards!.map((profile) => profile.id)).not.toContain(target.id)
      );
    });

    it('al refrescar, la carta deshecha toma los datos nuevos (p. ej. la foto)', async () => {
      setMockPremium(true);
      const { result } = await renderDeck('par');
      const target = result.current.cards![0];
      const real = repositories.discovery.getDeck.bind(repositories.discovery);
      jest
        .spyOn(repositories.discovery, 'getDeck')
        .mockImplementation(async (filter) =>
          (await real(filter)).map((profile) => ({ ...profile, location: 'Otra ciudad' }))
        );

      await act(async () => {
        result.current.decide(target, 'pass');
      });
      await act(async () => {
        await result.current.undo();
      });

      await waitFor(() => expect(result.current.cards![0].location).toBe('Otra ciudad'));
      expect(result.current.cards![0].id).toBe(target.id);
    });

    it('si la pantalla se remonta, deshacer trae de vuelta una carta que esta sesión no conocía', async () => {
      setMockPremium(true);
      // Se decide fuera del hook, como antes de que la pantalla se remontara.
      const first = (await repositories.discovery.getDeck({ mode: 'par' }))[0];
      await repositories.discovery.recordDecision(first.id, 'pass', 'par');
      const { result } = await renderDeck('par');
      expect(result.current.cards!.map((profile) => profile.id)).not.toContain(first.id);

      await act(async () => {
        await result.current.undo();
      });

      await waitFor(() => expect(result.current.cards![0]?.id).toBe(first.id));
    });

    it('el Super Like usa la tarjeta actual aunque el deck se refresque con los mismos ids', async () => {
      const real = repositories.discovery.getDeck.bind(repositories.discovery);
      let name = 'Antes';
      jest
        .spyOn(repositories.discovery, 'getDeck')
        .mockImplementation(async (filter) =>
          (await real(filter)).map((profile) => ({ ...profile, name }))
        );
      const { result } = await renderDeck('par');
      expect(cardWithId(result.current.cards, RECIPROCAL_ID).name).toBe('Antes');

      name = 'Después';
      await act(async () => {
        result.current.refresh();
      });
      await waitFor(() =>
        expect(cardWithId(result.current.cards, RECIPROCAL_ID).name).toBe('Después')
      );

      await act(async () => {
        result.current.superLike(RECIPROCAL_ID);
      });

      await waitFor(() => expect(result.current.match).not.toBeNull());
      expect(result.current.match!.profile.name).toBe('Después');
    });

    it('deshacer dos veces seguidas devuelve las dos, la última arriba', async () => {
      setMockPremium(true);
      const { result } = await renderDeck('par');
      const [first, second] = result.current.cards!;

      await act(async () => {
        result.current.decide(first, 'pass');
      });
      await act(async () => {
        result.current.decide(second, 'pass');
      });
      await act(async () => {
        await result.current.undo();
      });
      await act(async () => {
        await result.current.undo();
      });

      await waitFor(() =>
        expect(result.current.cards!.slice(0, 2).map((profile) => profile.id)).toEqual([
          first.id,
          second.id,
        ])
      );
    });

    it('deshacer la misma carta otra vez no la duplica', async () => {
      setMockPremium(true);
      const { result } = await renderDeck('par');
      const target = result.current.cards![0];

      for (let round = 0; round < 2; round += 1) {
        await act(async () => {
          result.current.decide(target, 'pass');
        });
        await act(async () => {
          await result.current.undo();
        });
      }

      const ids = result.current.cards!.map((profile) => profile.id);
      expect(ids.filter((id) => id === target.id)).toHaveLength(1);
      expect(ids[0]).toBe(target.id);
    });

    it('un Super Like sobre una tarjeta que no está en el deck no hace nada', async () => {
      const recordDecision = jest.spyOn(repositories.discovery, 'recordDecision');
      const { result } = await renderDeck('par');

      await act(async () => {
        result.current.superLike('no-existe');
      });

      expect(recordDecision).not.toHaveBeenCalled();
    });

    it('decidir tras cambiar de modo empieza una sesión nueva', async () => {
      const { result, rerender } = await renderDeck('par');
      await act(async () => {
        result.current.decide(result.current.cards![0], 'pass');
      });

      await rerender({ mode: 'lockin' });
      await waitFor(() => expect(result.current.cards).not.toBeNull());
      const target = result.current.cards![0];
      await act(async () => {
        result.current.decide(target, 'pass');
      });

      expect(result.current.cards!.map((profile) => profile.id)).not.toContain(target.id);
    });

    it('un fallo ajeno al cupo al deshacer o al hacer Boost se expone como error', async () => {
      setMockPremium(true);
      const { result } = await renderDeck('par');
      const failure = new Error('Sin conexión.');
      jest.spyOn(repositories.premium, 'undoLastDecision').mockRejectedValue(failure);
      jest.spyOn(repositories.premium, 'activateBoost').mockRejectedValue('texto suelto');

      await act(async () => {
        await result.current.undo();
      });
      expect(result.current.error).toBe(failure);

      await act(async () => {
        await result.current.boost();
      });
      expect(result.current.error?.message).toBe('texto suelto');
      expect(result.current.blocked).toBeNull();
    });

    it('un cupo agotado al deshacer abre la hoja con su causa', async () => {
      setMockPremium(true);
      const { result } = await renderDeck('par');
      jest
        .spyOn(repositories.premium, 'undoLastDecision')
        .mockRejectedValue(new QuotaExceededError('abuse', null));

      await act(async () => {
        await result.current.undo();
      });

      expect(result.current.blocked).toEqual({ kind: 'abuse', resetsAt: null });
    });

    it('un Boost ya usado abre la hoja con la hora del servidor', async () => {
      setMockPremium(true);
      const { result } = await renderDeck('par');
      await act(async () => {
        await result.current.boost();
      });

      await act(async () => {
        await result.current.boost();
      });

      expect(result.current.blocked).toMatchObject({ kind: 'boost' });
    });

    it('un fallo al guardar que no es de cupo sigue siendo un error de guardado', async () => {
      jest.spyOn(repositories.discovery, 'recordDecision').mockRejectedValue('texto suelto');
      const { result } = await renderDeck('par');

      await act(async () => {
        result.current.decide(result.current.cards![0], 'like');
      });

      await waitFor(() => expect(result.current.error?.message).toBe('texto suelto'));
      expect(result.current.blocked).toBeNull();
    });

    it('si no se pueden leer los cupos, comprobar el límite no bloquea nada', async () => {
      const { result } = await renderDeck('par');
      jest.spyOn(repositories.premium, 'getQuotas').mockRejectedValue(new Error('sin red'));

      await act(async () => {
        await result.current.checkLikeLimit();
      });

      expect(result.current.blocked).toBeNull();
    });
  });
});
