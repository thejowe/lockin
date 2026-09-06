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

import { DataProvider } from '@/data';
import { createMockRepositories, CURRENT_USER_ID, resetState } from '@/data/mock';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';

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
});
