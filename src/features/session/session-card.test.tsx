/**
 * La tarjeta de sesión del chat en sus cinco estados, contra el mock real.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DataProvider, SessionConflictError } from '@/data';
import { createMockRepositories, createMockSessionRepository, resetState } from '@/data/mock';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';
import { buildProfileInput } from '@/data/test-fixtures';

import { SessionCard } from './session-card';

import type { MatchWithProfile, Profile, Repositories } from '@/data';

const mockRouter = { push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

const NURIA = SEED_RECIPROCAL_IDS[0];
const MINUTE = 60_000;

let repositories: Repositories;
let match: MatchWithProfile;
let me: Profile;

beforeEach(async () => {
  jest.restoreAllMocks();
  mockRouter.push.mockClear();
  resetState();
  repositories = createMockRepositories();
  me = await repositories.profiles.saveCurrent(buildProfileInput());
  const { match: created } = await repositories.discovery.recordDecision(NURIA, 'like');
  match = (await repositories.matches.getById(created!.id))!;
});

afterEach(() => {
  jest.useRealTimers();
});

const renderCard = () =>
  render(
    <DataProvider value={repositories}>
      <SessionCard match={match} me={me} />
    </DataProvider>
  );

const inAnHour = () => new Date(Date.now() + 60 * MINUTE).toISOString();

describe('SessionCard', () => {
  it('sin sesión ofrece agendar y abre la hoja', async () => {
    await renderCard();

    await fireEvent.press(await screen.findByLabelText('Agendar sesión Lock-In'));

    expect(screen.getByLabelText('Proponer sesión')).toBeTruthy();
  });

  it('proponer desde la hoja deja la tarjeta esperando a la otra persona', async () => {
    await renderCard();
    await fireEvent.press(await screen.findByLabelText('Agendar sesión Lock-In'));

    await fireEvent.press(screen.getByLabelText('Proponer sesión'));

    await waitFor(() => expect(screen.getByText('Esperando a Núria')).toBeTruthy());
    expect((await repositories.sessions.getActive(match.id))?.status).toBe('propuesta');
  });

  it('una propuesta recibida se acepta desde la tarjeta', async () => {
    await createMockSessionRepository(NURIA).propose({
      matchId: match.id,
      startsAt: inAnHour(),
      blocks: 2,
    });

    await renderCard();
    await fireEvent.press(await screen.findByLabelText('Aceptar sesión'));

    await waitFor(() => expect(screen.getByText('Sesión acordada')).toBeTruthy());
  });

  it('rechazar vuelve a ofrecer agendar', async () => {
    await createMockSessionRepository(NURIA).propose({
      matchId: match.id,
      startsAt: inAnHour(),
      blocks: 1,
    });

    await renderCard();
    await fireEvent.press(await screen.findByLabelText('Rechazar sesión'));

    await waitFor(() => expect(screen.getByLabelText('Agendar sesión Lock-In')).toBeTruthy());
  });

  it('cancelar la propia vuelve a ofrecer agendar', async () => {
    await repositories.sessions.propose({ matchId: match.id, startsAt: inAnHour(), blocks: 1 });

    await renderCard();
    await fireEvent.press(await screen.findByLabelText('Cancelar sesión'));

    await waitFor(() => expect(screen.getByLabelText('Agendar sesión Lock-In')).toBeTruthy());
  });

  it('si la sesión cambió por el camino, lo dice', async () => {
    await createMockSessionRepository(NURIA).propose({
      matchId: match.id,
      startsAt: inAnHour(),
      blocks: 1,
    });
    jest.spyOn(repositories.sessions, 'respond').mockRejectedValue(new SessionConflictError('ya'));

    await renderCard();
    await fireEvent.press(await screen.findByLabelText('Aceptar sesión'));

    await waitFor(() => expect(screen.getByText('La sesión ha cambiado.')).toBeTruthy());
  });

  it('dentro de la ventana lleva a la pantalla de sesión', async () => {
    jest.useFakeTimers();
    const base = Date.now();
    jest.setSystemTime(base);
    const startsAt = new Date(base + 5 * MINUTE + 1_000).toISOString();
    const session = await repositories.sessions.propose({ matchId: match.id, startsAt, blocks: 1 });
    await createMockSessionRepository(NURIA).respond(session.id, 'aceptada');
    jest.setSystemTime(base + 2_000);

    await renderCard();
    await fireEvent.press(await screen.findByLabelText('Entrar a la sesión'));

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/session/[sessionId]',
      params: { sessionId: session.id },
    });
  });
});
