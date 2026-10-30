/**
 * Tests de la tab Matches.
 *
 * Compone una lista, y su única decisión propia es cuándo enseñar el estado
 * vacío: mientras carga o si ha fallado, "todavía no hay nadie al otro lado" es
 * mentira — aún no se sabe. Ese matiz es el que se prueba aquí, junto con el
 * aviso de error, que es lo que queda en pantalla cuando la lectura no llega.
 *
 * Desde el 2026-10-12 la pantalla ya no monta rachas ni salas Lock-In, y eso
 * también se fija aquí. La lista lleva `testID` para llegar a su
 * `RefreshControl`.
 *
 * Ojo: en RNTL 14 `render` es asíncrono.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { act } from 'react';

import { buildProfileInput } from '@/data/test-fixtures';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';

import { renderRoute, repositories, resetRepositories, resetRouter, router } from '../routes';

import MatchesScreen from '../../src/app/(tabs)/matches';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

const EMPTY_HEADLINE = 'Todavía no hay nadie al otro lado';
const ERROR_NOTICE = 'No hemos podido cargar tus matches. Desliza hacia abajo para reintentar.';

beforeEach(() => {
  resetRepositories();
  resetRouter();
});

describe('MatchesScreen', () => {
  it('encabeza la pantalla con lo que es', async () => {
    await renderRoute(<MatchesScreen />);

    expect(screen.getByText('Matches')).toBeTruthy();
    expect(screen.getByText('Con quién has conectado')).toBeTruthy();
  });

  it('sin matches enseña el estado vacío, ya resuelto', async () => {
    await renderRoute(<MatchesScreen />);

    await waitFor(() => expect(screen.getByText(EMPTY_HEADLINE)).toBeTruthy());
    expect(screen.queryByText(ERROR_NOTICE)).toBeNull();
  });

  it('con un match hecho lista su fila y retira el estado vacío', async () => {
    await repositories.profiles.saveCurrent(buildProfileInput());
    const { match } = await repositories.discovery.recordDecision(SEED_RECIPROCAL_IDS[0], 'like');
    expect(match).not.toBeNull();
    const counterpart = await repositories.profiles.getById(SEED_RECIPROCAL_IDS[0]);

    await renderRoute(<MatchesScreen />);

    await waitFor(() => expect(screen.getByText(counterpart!.name)).toBeTruthy());
    expect(screen.queryByText(EMPTY_HEADLINE)).toBeNull();
  });

  it('no enseña rachas ni salas Lock-In: el producto es solo cofundador', async () => {
    await repositories.profiles.saveCurrent(buildProfileInput());
    await repositories.discovery.recordDecision(SEED_RECIPROCAL_IDS[0], 'like');
    await repositories.discovery.recordDecision(SEED_RECIPROCAL_IDS[1], 'like');
    const counterpart = await repositories.profiles.getById(SEED_RECIPROCAL_IDS[0]);
    const listLive = jest.spyOn(repositories.rooms, 'listLive');

    await renderRoute(<MatchesScreen />);
    await waitFor(() => expect(screen.getByText(counterpart!.name)).toBeTruthy());

    expect(screen.queryByRole('button', { name: 'Convocar sala Lock-In' })).toBeNull();
    expect(screen.queryByText(/Racha/)).toBeNull();
    expect(listLive).not.toHaveBeenCalled();
  });

  it('tirar para refrescar relee los matches', async () => {
    const getMatches = jest.spyOn(repositories.matches, 'list');

    await renderRoute(<MatchesScreen />);
    await waitFor(() => expect(getMatches).toHaveBeenCalledTimes(1));

    await act(async () => {
      screen.getByTestId('matches-list').props.refreshControl.props.onRefresh();
    });

    await waitFor(() => expect(getMatches).toHaveBeenCalledTimes(2));
  });

  it('si la lectura falla avisa en vez de fingir que no hay matches', async () => {
    jest.spyOn(repositories.matches, 'list').mockRejectedValue(new Error('sin red'));

    await renderRoute(<MatchesScreen />);

    await waitFor(() => expect(screen.getByText(ERROR_NOTICE)).toBeTruthy());
    expect(screen.queryByText(EMPTY_HEADLINE)).toBeNull();
  });
});

describe('MatchesScreen: likes recibidos', () => {
  it('enseña la fila «Te han dado like (N)» y abre /likes al tocarla', async () => {
    await renderRoute(<MatchesScreen />);

    await waitFor(() => expect(screen.getByText('Te han dado like (5)')).toBeTruthy());
    await fireEvent.press(screen.getByText('Te han dado like (5)'));

    expect(router.push).toHaveBeenCalledWith('/likes');
  });

  it('tirar para refrescar relee también el conteo de likes recibidos', async () => {
    const count = jest.spyOn(repositories.premium, 'countIncomingLikes');
    await renderRoute(<MatchesScreen />);
    await waitFor(() => expect(count).toHaveBeenCalledTimes(1));

    await act(async () => {
      screen.getByTestId('matches-list').props.refreshControl.props.onRefresh();
    });

    await waitFor(() => expect(count).toHaveBeenCalledTimes(2));
  });
});
