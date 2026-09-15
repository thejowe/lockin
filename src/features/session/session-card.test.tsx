/**
 * La tarjeta de sesión del chat en sus seis estados, contra el mock real.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DataProvider, SessionConflictError, SessionWindowError } from '@/data';
import { createMockRepositories, createMockSessionRepository, resetState } from '@/data/mock';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';
import { buildProfileInput } from '@/data/test-fixtures';

import { setReminderPermissionDenied } from './reminder-permission';
import { SessionCard } from './session-card';
import { SESSION_TICK_MS } from './use-active-session';

import type { MatchWithProfile, Profile, Repositories } from '@/data';

const mockRouter = { push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

const NURIA = SEED_RECIPROCAL_IDS[0];
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

let repositories: Repositories;
let match: MatchWithProfile;
let me: Profile;

beforeEach(async () => {
  jest.restoreAllMocks();
  mockRouter.push.mockClear();
  await AsyncStorage.clear();
  setReminderPermissionDenied(false);
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

/**
 * Una sesión de un bloque ya terminada, con las dos personas dentro: la que
 * `getRatable` devuelve. Con reloj falso, que es lo único que mueve a la vez al
 * mock y a la tarjeta; entrar se registra desde los dos lados antes del final
 * porque es lo que mira la regla 4.
 */
async function endedSession() {
  jest.useFakeTimers();
  const base = Date.now();
  jest.setSystemTime(base);
  const startsAt = new Date(base + 5 * MINUTE + 1_000).toISOString();
  const session = await repositories.sessions.propose({ matchId: match.id, startsAt, blocks: 1 });
  const counterpart = createMockSessionRepository(NURIA);
  await counterpart.respond(session.id, 'aceptada');
  jest.setSystemTime(base + 6 * MINUTE);
  await repositories.sessions.join(session.id);
  await counterpart.join(session.id);
  // `endsAt` es `startsAt + 30 min`: aquí ya terminó y la ventana de 24 h está abierta.
  jest.setSystemTime(base + 40 * MINUTE);
  return session;
}

/**
 * Propone, acepta y hace entrar a las dos personas en la sesión que empieza en
 * `startsAt`. Base de `pastStreakOfTwo` y reusable para una tercera sesión.
 */
async function proposeAcceptJoin(startsAt: string) {
  const session = await repositories.sessions.propose({ matchId: match.id, startsAt, blocks: 1 });
  const counterpart = createMockSessionRepository(NURIA);
  await counterpart.respond(session.id, 'aceptada');
  jest.setSystemTime(Date.parse(startsAt) + MINUTE);
  await repositories.sessions.join(session.id);
  await counterpart.join(session.id);
  return session;
}

/**
 * Racha de 2 ya viva: dos sesiones pasadas con las dos personas dentro y un
 * hueco de 2 días entre ellas (menos de los 7 que la romperían), con el reloj
 * detenido después del final de la segunda — ya fuera de su ventana de
 * valoración (24 h) para no arrastrar una repesca al estado bajo prueba, pero
 * dentro de `aliveUntil` (+7 días).
 */
async function pastStreakOfTwo() {
  jest.useFakeTimers();
  jest.setSystemTime(Date.now());
  await proposeAcceptJoin(new Date(Date.now() + 5 * MINUTE + 1_000).toISOString());
  jest.setSystemTime(Date.now() + 2 * DAY);
  const second = await proposeAcceptJoin(new Date(Date.now() + 5 * MINUTE + 1_000).toISOString());
  const secondEndsAt = Date.parse(second.startsAt) + 30 * MINUTE;
  jest.setSystemTime(secondEndsAt + 25 * HOUR);
}

describe('SessionCard — racha', () => {
  it('en agendar se pintan las dos líneas de la racha', async () => {
    await pastStreakOfTwo();

    await renderCard();

    await waitFor(() => expect(screen.getByText('Racha de 2 sesiones seguidas')).toBeTruthy());
    expect(screen.getByText(/Sin sesión, se rompe/)).toBeTruthy();
  });

  it('en esperando solo se pinta la primera línea', async () => {
    await pastStreakOfTwo();
    await repositories.sessions.propose({ matchId: match.id, startsAt: inAnHour(), blocks: 1 });

    await renderCard();

    await waitFor(() => expect(screen.getByText('Esperando a Núria')).toBeTruthy());
    expect(screen.getByText('Racha de 2 sesiones seguidas')).toBeTruthy();
    expect(screen.queryByText(/Sin sesión, se rompe/)).toBeNull();
  });

  it('en recibida solo se pinta la primera línea', async () => {
    await pastStreakOfTwo();
    await createMockSessionRepository(NURIA).propose({
      matchId: match.id,
      startsAt: inAnHour(),
      blocks: 1,
    });

    await renderCard();

    await waitFor(() => expect(screen.getByText('Núria propone una sesión')).toBeTruthy());
    expect(screen.getByText('Racha de 2 sesiones seguidas')).toBeTruthy();
    expect(screen.queryByText(/Sin sesión, se rompe/)).toBeNull();
  });

  it('en aceptada solo se pinta la primera línea', async () => {
    await pastStreakOfTwo();
    const session = await repositories.sessions.propose({
      matchId: match.id,
      startsAt: inAnHour(),
      blocks: 1,
    });
    await createMockSessionRepository(NURIA).respond(session.id, 'aceptada');

    await renderCard();

    await waitFor(() => expect(screen.getByText('Sesión acordada')).toBeTruthy());
    expect(screen.getByText('Racha de 2 sesiones seguidas')).toBeTruthy();
    expect(screen.queryByText(/Sin sesión, se rompe/)).toBeNull();
  });

  it('en entrar solo se pinta la primera línea', async () => {
    await pastStreakOfTwo();
    const base = Date.now();
    const startsAt = new Date(base + 5 * MINUTE + 1_000).toISOString();
    const session = await repositories.sessions.propose({ matchId: match.id, startsAt, blocks: 1 });
    await createMockSessionRepository(NURIA).respond(session.id, 'aceptada');
    jest.setSystemTime(base + 2_000);

    await renderCard();

    await waitFor(() => expect(screen.getByText('Es la hora')).toBeTruthy());
    expect(screen.getByText('Racha de 2 sesiones seguidas')).toBeTruthy();
    expect(screen.queryByText(/Sin sesión, se rompe/)).toBeNull();
  });

  it('en valorar no se pinta ninguna línea de racha', async () => {
    await pastStreakOfTwo();
    const third = await proposeAcceptJoin(new Date(Date.now() + 5 * MINUTE + 1_000).toISOString());
    const thirdEndsAt = Date.parse(third.startsAt) + 30 * MINUTE;
    jest.setSystemTime(thirdEndsAt + MINUTE);

    await renderCard();

    await waitFor(() => expect(screen.getByText('¿Qué tal fue la sesión con Núria?')).toBeTruthy());
    expect(screen.queryByText(/Racha de/)).toBeNull();
  });

  it('con racha 1 no se pinta nada', async () => {
    jest.useFakeTimers();
    const base = Date.now();
    jest.setSystemTime(base);
    const session = await proposeAcceptJoin(new Date(base + 5 * MINUTE + 1_000).toISOString());
    const endsAt = Date.parse(session.startsAt) + 30 * MINUTE;
    jest.setSystemTime(endsAt + 25 * HOUR);

    await renderCard();

    await waitFor(() => expect(screen.getByLabelText('Agendar sesión Lock-In')).toBeTruthy());
    expect(screen.queryByText(/Racha de/)).toBeNull();
  });

  it('si listStreaks rechaza, no se pinta ninguna racha', async () => {
    await pastStreakOfTwo();
    jest.spyOn(repositories.sessions, 'listStreaks').mockRejectedValue(new Error('sin red'));

    await renderCard();

    await waitFor(() => expect(screen.getByLabelText('Agendar sesión Lock-In')).toBeTruthy());
    expect(screen.queryByText(/Racha de/)).toBeNull();
  });
});

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

  it('una sesión terminada con los dos dentro se valora desde la tarjeta', async () => {
    const session = await endedSession();

    await renderCard();

    await fireEvent.press(await screen.findByRole('radio', { name: 'Genial' }));

    await waitFor(() => expect(screen.getByText('Gracias — solo lo ves tú')).toBeTruthy());
    await expect(repositories.sessions.getMyRating(session.id)).resolves.toBe('genial');

    // El tic relee también `getRatable`, así que la tarjeta vuelve a agendar sola.
    await act(async () => {
      jest.advanceTimersByTime(SESSION_TICK_MS);
    });
    await waitFor(() => expect(screen.getByLabelText('Agendar sesión Lock-In')).toBeTruthy());
  });

  it('una propuesta viva gana a la valoración pendiente', async () => {
    await endedSession();
    await createMockSessionRepository(NURIA).propose({
      matchId: match.id,
      startsAt: inAnHour(),
      blocks: 1,
    });

    await renderCard();

    await waitFor(() => expect(screen.getByText('Núria propone una sesión')).toBeTruthy());
    expect(screen.queryByText('¿Qué tal fue la sesión con Núria?')).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Genial' })).toBeNull();
  });

  it('si no se ha podido guardar la valoración, se reintenta con otro toque', async () => {
    await endedSession();
    const rate = jest
      .spyOn(repositories.sessions, 'rate')
      .mockRejectedValueOnce(new Error('sin red'));

    await renderCard();
    await fireEvent.press(await screen.findByRole('radio', { name: 'Bien' }));

    await waitFor(() => expect(screen.getByText('No se ha podido guardar')).toBeTruthy());

    rate.mockRestore();
    await fireEvent.press(screen.getByRole('radio', { name: 'Bien' }));

    await waitFor(() => expect(screen.getByText('Gracias — solo lo ves tú')).toBeTruthy());
  });

  it('si el servidor ya no la acepta, la tarjeta deja de ofrecer los chips', async () => {
    await endedSession();
    jest
      .spyOn(repositories.sessions, 'rate')
      .mockRejectedValue(new SessionWindowError('pasaron 24 horas'));

    await renderCard();
    await fireEvent.press(await screen.findByRole('radio', { name: 'Floja' }));

    await waitFor(() => expect(screen.getByText('Ya no se puede valorar')).toBeTruthy());
    expect(screen.queryByRole('radio', { name: 'Floja' })).toBeNull();
    expect(screen.queryByText('¿Qué tal fue la sesión con Núria?')).toBeNull();
  });

  it('con los avisos denegados lo avisa una vez y se puede descartar', async () => {
    setReminderPermissionDenied(true);

    await renderCard();

    await waitFor(() =>
      expect(screen.getByText('Activa los avisos para no perderte la sesión.')).toBeTruthy()
    );
    await fireEvent.press(screen.getByLabelText('Entendido'));
    expect(screen.queryByText('Activa los avisos para no perderte la sesión.')).toBeNull();
    await expect(AsyncStorage.getItem('lockin:reminder-hint-dismissed')).resolves.toBe('1');
  });
});
