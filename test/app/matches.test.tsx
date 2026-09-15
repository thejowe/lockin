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
import { advanceMockClock, createMockSessionRepository, mockNowMs } from '@/data/mock';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';

import { renderRoute, repositories, resetRepositories, resetRouter } from '../routes';

import MatchesScreen from '../../src/app/(tabs)/matches';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

const EMPTY_HEADLINE = 'Todavía no hay nadie al otro lado';
const ERROR_NOTICE = 'No hemos podido cargar tus matches. Desliza hacia abajo para reintentar.';
const MINUTE = 60_000;

/**
 * Una sesión aceptada con las dos personas dentro, como `sharedSession` de la
 * suite de contrato: el reloj simulado del mock salta al margen de entrada sin
 * esperar.
 */
async function sharedSession(matchId: string, counterpartId: string) {
  const theirs = createMockSessionRepository(counterpartId);
  const session = await repositories.sessions.propose({
    matchId,
    startsAt: new Date(mockNowMs() + 5 * MINUTE + 2_000).toISOString(),
    blocks: 1,
  });
  await theirs.respond(session.id, 'aceptada');
  advanceMockClock(3_000);
  await repositories.sessions.join(session.id);
  await theirs.join(session.id);
}

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

  it('la fila de una pareja con dos sesiones compartidas seguidas lleva su racha', async () => {
    await repositories.profiles.saveCurrent(buildProfileInput());
    const [withStreakId, withoutStreakId] = SEED_RECIPROCAL_IDS;
    const { match } = await repositories.discovery.recordDecision(withStreakId, 'like');
    await repositories.discovery.recordDecision(withoutStreakId, 'like');
    await sharedSession(match!.id, withStreakId);
    advanceMockClock(36 * MINUTE);
    await sharedSession(match!.id, withStreakId);
    const withStreak = await repositories.profiles.getById(withStreakId);
    const withoutStreak = await repositories.profiles.getById(withoutStreakId);

    await renderRoute(<MatchesScreen />);

    await waitFor(() => expect(screen.getByText('· Racha 2')).toBeTruthy());
    expect(screen.getAllByText(/Racha/)).toHaveLength(1);
    expect(
      screen.getByLabelText(
        new RegExp(`^Conversación con ${withStreak!.name}\\. Racha de 2 sesiones seguidas\\. `)
      )
    ).toBeTruthy();
    expect(
      screen.getByLabelText(new RegExp(`^Conversación con ${withoutStreak!.name}\\.`))
    ).toBeTruthy();
    expect(screen.queryByLabelText(new RegExp(`${withoutStreak!.name}\\. Racha`))).toBeNull();
  });

  it('si la lectura falla avisa en vez de fingir que no hay matches', async () => {
    jest.spyOn(repositories.matches, 'list').mockRejectedValue(new Error('sin red'));

    await renderRoute(<MatchesScreen />);

    await waitFor(() => expect(screen.getByText(ERROR_NOTICE)).toBeTruthy());
    expect(screen.queryByText(EMPTY_HEADLINE)).toBeNull();
  });
});
