/**
 * Tests de la tab Matches.
 *
 * Compone una lista, y su única decisión propia es cuándo enseñar el estado
 * vacío: mientras carga o si ha fallado, "todavía no hay nadie al otro lado" es
 * mentira — aún no se sabe. Ese matiz es el que se prueba aquí, junto con el
 * aviso de error, que es lo que queda en pantalla cuando la lectura no llega.
 *
 * El tirar-para-refrescar no se prueba desde aquí: el `RefreshControl` no es
 * alcanzable sin ponerle un `testID` a la lista, y `useMatches` ya cubre su
 * `refresh` en `use-matches.test.tsx`.
 *
 * Ojo: en RNTL 14 `render` es asíncrono.
 */

import { screen, waitFor } from '@testing-library/react-native';

import { buildProfileInput } from '@/data/test-fixtures';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';

import { renderRoute, repositories, resetRepositories, resetRouter } from '../routes';

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

  it('si la lectura falla avisa en vez de fingir que no hay matches', async () => {
    jest.spyOn(repositories.matches, 'list').mockRejectedValue(new Error('sin red'));

    await renderRoute(<MatchesScreen />);

    await waitFor(() => expect(screen.getByText(ERROR_NOTICE)).toBeTruthy());
    expect(screen.queryByText(EMPTY_HEADLINE)).toBeNull();
  });
});
