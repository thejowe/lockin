/**
 * La cuadrícula de «Te han dado like».
 *
 * Sin Premium nunca se pintan fotos ni nombres reales: solo relleno. Con Premium
 * salen los perfiles, los Super Likes primero y con insignia. Si el like desde la
 * tarjeta choca con un cupo o con Premium, la tarjeta se queda y se abre la hoja.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { act } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DataProvider, PremiumRequiredError, QuotaExceededError, useQuery } from '@/data';
import { emitMediaStale } from '@/data/media-refresh';
import { createMockRepositories, mockSuperLikeFrom, resetState, setMockPremium } from '@/data/mock';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';
import { buildProfileInput } from '@/data/test-fixtures';

import { IncomingLikes } from './incoming-likes';
import { openPaywall } from './open-paywall';

import type { Repositories } from '@/data';

jest.mock('./open-paywall', () => ({ openPaywall: jest.fn() }));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

let repositories: Repositories;
const onOpenChat = jest.fn();

async function setup(extra?: React.ReactNode) {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <DataProvider value={repositories}>
        <IncomingLikes onOpenChat={onOpenChat} />
        {extra}
      </DataProvider>
    </SafeAreaProvider>
  );
}

async function nameOf(id: string) {
  return (await repositories.profiles.getById(id))!.name;
}

beforeEach(async () => {
  jest.restoreAllMocks();
  (openPaywall as jest.Mock).mockClear();
  onOpenChat.mockClear();
  resetState();
  repositories = createMockRepositories();
  await repositories.profiles.saveCurrent(buildProfileInput());
});

describe('IncomingLikes sin Premium', () => {
  it('pinta una tarjeta de relleno por like, sin nombres ni fotos, y el botón de Premium', async () => {
    await setup();

    await waitFor(() => expect(screen.getAllByTestId('incoming-like-filler')).toHaveLength(5));
    expect(screen.queryByTestId('avatar-photo')).toBeNull();
    expect(screen.queryByText(await nameOf(SEED_RECIPROCAL_IDS[0]))).toBeNull();
    expect(screen.getByText('Hazte Premium')).toBeTruthy();
  });

  it('la rejilla de candados se centra, no se pega a la izquierda', async () => {
    await setup();

    const [first] = await waitFor(() => screen.getAllByTestId('incoming-like-filler'));
    const grid = first.parent!;
    expect(StyleSheet.flatten(grid.props.style)).toMatchObject({ justifyContent: 'center' });
  });

  it('«Hazte Premium» abre el paywall', async () => {
    await setup();
    await waitFor(() => expect(screen.getByText('Hazte Premium')).toBeTruthy());

    await fireEvent.press(screen.getByText('Hazte Premium'));

    expect(openPaywall).toHaveBeenCalledTimes(1);
  });

  it('no pide la lista al servidor', async () => {
    const spy = jest.spyOn(repositories.premium, 'listIncomingLikes');
    await setup();
    await waitFor(() =>
      expect(screen.getAllByTestId('incoming-like-filler').length).toBeGreaterThan(0)
    );

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('IncomingLikes con Premium', () => {
  beforeEach(() => setMockPremium(true));

  it('lista los perfiles, con los Super Likes primero y con insignia', async () => {
    mockSuperLikeFrom(SEED_RECIPROCAL_IDS[3]);
    await setup();

    const superName = await nameOf(SEED_RECIPROCAL_IDS[3]);
    await waitFor(() => expect(screen.getByText(superName)).toBeTruthy());
    const tiles = screen.getAllByTestId('incoming-like-tile');
    expect(tiles).toHaveLength(5);
    expect(tiles[0]).toHaveTextContent(new RegExp(superName));
    expect(screen.getAllByText('Super Like')).toHaveLength(1);
    expect(screen.queryByTestId('incoming-like-filler')).toBeNull();
    expect(screen.queryByText('Hazte Premium')).toBeNull();
  });

  it('el like desde la tarjeta crea match y lo celebra', async () => {
    await setup();
    const name = await nameOf(SEED_RECIPROCAL_IDS[0]);
    await waitFor(() => expect(screen.getByText(name)).toBeTruthy());

    await fireEvent.press(screen.getByText(name));
    await fireEvent.press(screen.getByText('Me gusta'));

    await waitFor(() => expect(screen.getByText('Abrir chat')).toBeTruthy());
    await fireEvent.press(screen.getByText('Abrir chat'));
    expect(onOpenChat).toHaveBeenCalledTimes(1);
  });

  it('pasar quita la tarjeta de la lista', async () => {
    await setup();
    const name = await nameOf(SEED_RECIPROCAL_IDS[0]);
    await waitFor(() => expect(screen.getByText(name)).toBeTruthy());

    await fireEvent.press(screen.getByText(name));
    await fireEvent.press(screen.getByText('Pasar'));

    await waitFor(() => expect(screen.getAllByTestId('incoming-like-tile')).toHaveLength(4));
    expect(screen.queryByText(name)).toBeNull();
  });

  it('si el like choca con el cupo, la tarjeta sigue en la lista y se abre la hoja', async () => {
    jest
      .spyOn(repositories.discovery, 'recordDecision')
      .mockRejectedValue(new QuotaExceededError('likes', '2026-10-31T08:00:00Z'));
    await setup();
    const name = await nameOf(SEED_RECIPROCAL_IDS[0]);
    await waitFor(() => expect(screen.getByText(name)).toBeTruthy());

    await fireEvent.press(screen.getByText(name));
    await fireEvent.press(screen.getByText('Me gusta'));

    await waitFor(() => expect(screen.getByText(/Sin likes hasta/)).toBeTruthy());
    expect(screen.getAllByTestId('incoming-like-tile')).toHaveLength(5);
  });

  it('si el like exige Premium, la tarjeta sigue en la lista y se abre la hoja', async () => {
    jest
      .spyOn(repositories.discovery, 'recordDecision')
      .mockRejectedValue(new PremiumRequiredError());
    await setup();
    const name = await nameOf(SEED_RECIPROCAL_IDS[0]);
    await waitFor(() => expect(screen.getByText(name)).toBeTruthy());

    await fireEvent.press(screen.getByText(name));
    await fireEvent.press(screen.getByText('Me gusta'));

    await waitFor(() => expect(screen.getByText('Esto es de Premium')).toBeTruthy());
    expect(screen.getAllByTestId('incoming-like-tile')).toHaveLength(5);
  });

  it('pagina con el cursor de la última tarjeta', async () => {
    const all = await repositories.premium.listIncomingLikes();
    const spy = jest
      .spyOn(repositories.premium, 'listIncomingLikes')
      .mockResolvedValueOnce(all.slice(0, 2))
      .mockResolvedValueOnce(all.slice(2));
    await setup();
    await waitFor(() => expect(screen.getAllByTestId('incoming-like-tile')).toHaveLength(2));

    await fireEvent(screen.getByTestId('incoming-likes-list'), 'endReached');

    await waitFor(() => expect(screen.getAllByTestId('incoming-like-tile')).toHaveLength(5));
    const last = all[1];
    expect(spy.mock.calls[1][0]?.before).toBe(
      `${last.isSuper ? 1 : 0}|${last.likedAt}|${last.profile.id}`
    );
  });

  it('sin likes pendientes lo dice', async () => {
    jest.spyOn(repositories.premium, 'listIncomingLikes').mockResolvedValue([]);
    jest.spyOn(repositories.premium, 'countIncomingLikes').mockResolvedValue(0);
    await setup();

    await waitFor(() => expect(screen.getByText('Nadie te ha dado like todavía')).toBeTruthy());
  });
});

describe('IncomingLikes: casos de borde', () => {
  beforeEach(() => setMockPremium(true));

  it('«Cerrar» deja la tarjeta en la lista sin decidir nada', async () => {
    const spy = jest.spyOn(repositories.discovery, 'recordDecision');
    await setup();
    const name = await nameOf(SEED_RECIPROCAL_IDS[0]);
    await waitFor(() => expect(screen.getByText(name)).toBeTruthy());

    await fireEvent.press(screen.getByText(name));
    await fireEvent.press(screen.getByText('Cerrar'));

    expect(spy).not.toHaveBeenCalled();
    expect(screen.getAllByTestId('incoming-like-tile')).toHaveLength(5);
  });

  it('si la lista no carga, lo dice', async () => {
    jest.spyOn(repositories.premium, 'listIncomingLikes').mockRejectedValue(new Error('red'));
    await setup();

    await waitFor(() => expect(screen.getByText('No hemos podido cargar tus likes.')).toBeTruthy());
  });

  it('un fallo inesperado al decidir deja la tarjeta y no abre ninguna hoja', async () => {
    jest.spyOn(repositories.discovery, 'recordDecision').mockRejectedValue(new Error('red'));
    await setup();
    const name = await nameOf(SEED_RECIPROCAL_IDS[0]);
    await waitFor(() => expect(screen.getByText(name)).toBeTruthy());

    await fireEvent.press(screen.getByText(name));
    await fireEvent.press(screen.getByText('Me gusta'));

    await waitFor(() => expect(screen.getAllByTestId('incoming-like-tile')).toHaveLength(5));
    expect(screen.queryByText(/Sin likes hasta/)).toBeNull();
  });
});

describe('IncomingLikes: refrescos y avisos', () => {
  beforeEach(() => setMockPremium(true));

  it('tras decidir, invalida el deck montado y el conteo', async () => {
    const run = jest.fn(async () => 1);
    function DeckProbe() {
      useQuery('deck:par', run);
      return null;
    }
    const count = jest.spyOn(repositories.premium, 'countIncomingLikes');
    await setup(<DeckProbe />);
    const name = await nameOf(SEED_RECIPROCAL_IDS[0]);
    await waitFor(() => expect(screen.getByText(name)).toBeTruthy());
    const runs = run.mock.calls.length;
    const counts = count.mock.calls.length;

    await fireEvent.press(screen.getByText(name));
    await fireEvent.press(screen.getByText('Pasar'));

    await waitFor(() => expect(run.mock.calls.length).toBeGreaterThan(runs));
    await waitFor(() => expect(count.mock.calls.length).toBeGreaterThan(counts));
  });

  it('sin Premium el contenido hace scroll', async () => {
    setMockPremium(false);
    await setup();

    await waitFor(() => expect(screen.getByTestId('incoming-likes-scroll')).toBeTruthy());
  });

  it('al caducar las fotos firmadas relee la lista y reemplaza los perfiles', async () => {
    const all = await repositories.premium.listIncomingLikes();
    const renamed = all.map((like, index) =>
      index === 0 ? { ...like, profile: { ...like.profile, name: 'Nombre Nuevo' } } : like
    );
    jest
      .spyOn(repositories.premium, 'listIncomingLikes')
      .mockResolvedValueOnce(all)
      .mockResolvedValue(renamed);
    await setup();
    await waitFor(() => expect(screen.getAllByTestId('incoming-like-tile')).toHaveLength(5));

    await act(async () => emitMediaStale());

    await waitFor(() => expect(screen.getByText('Nombre Nuevo')).toBeTruthy());
    expect(screen.queryByText(all[0].profile.name)).toBeNull();
    expect(screen.getAllByTestId('incoming-like-tile')).toHaveLength(5);
  });

  it('un fallo al decidir con la lista poblada avisa aparte y permite reintentar', async () => {
    const record = jest
      .spyOn(repositories.discovery, 'recordDecision')
      .mockRejectedValueOnce(new Error('red'));
    await setup();
    const name = await nameOf(SEED_RECIPROCAL_IDS[0]);
    await waitFor(() => expect(screen.getByText(name)).toBeTruthy());

    await fireEvent.press(screen.getByText(name));
    await fireEvent.press(screen.getByText('Pasar'));

    await waitFor(() =>
      expect(screen.getByText('No hemos podido guardar tu decisión.')).toBeTruthy()
    );
    expect(screen.getAllByTestId('incoming-like-tile')).toHaveLength(5);

    record.mockRestore();
    await fireEvent.press(screen.getByText('Reintentar'));

    await waitFor(() => expect(screen.getAllByTestId('incoming-like-tile')).toHaveLength(4));
    expect(screen.queryByText('No hemos podido guardar tu decisión.')).toBeNull();
  });
});

describe('IncomingLikes: cierres y fallos de paginación', () => {
  beforeEach(() => setMockPremium(true));

  it('«Entendido» cierra la hoja de cupo y la tarjeta sigue', async () => {
    jest
      .spyOn(repositories.discovery, 'recordDecision')
      .mockRejectedValueOnce(new QuotaExceededError('likes', '2026-10-31T08:00:00Z'));
    await setup();
    const name = await nameOf(SEED_RECIPROCAL_IDS[0]);
    await waitFor(() => expect(screen.getByText(name)).toBeTruthy());

    await fireEvent.press(screen.getByText(name));
    await fireEvent.press(screen.getByText('Me gusta'));
    await waitFor(() => expect(screen.getByText(/Sin likes hasta/)).toBeTruthy());
    await fireEvent.press(screen.getByText('Entendido'));
    expect(screen.queryByText(/Sin likes hasta/)).toBeNull();
    expect(screen.getAllByTestId('incoming-like-tile')).toHaveLength(5);
  });

  it('si falla una página siguiente, lo avisa sin perder las que ya hay', async () => {
    const all = await repositories.premium.listIncomingLikes();
    jest
      .spyOn(repositories.premium, 'listIncomingLikes')
      .mockResolvedValueOnce(all.slice(0, 2))
      .mockRejectedValueOnce(new Error('red'));
    await setup();
    await waitFor(() => expect(screen.getAllByTestId('incoming-like-tile')).toHaveLength(2));

    await fireEvent(screen.getByTestId('incoming-likes-list'), 'endReached');

    await waitFor(() => expect(screen.getAllByTestId('incoming-like-tile')).toHaveLength(2));
  });
});
