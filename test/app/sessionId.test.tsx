/**
 * Pantalla de sesión Lock-In.
 *
 * Reloj falso de Jest: el mock de sesiones y la pantalla leen `Date.now()`, así
 * que mover la hora del sistema mueve a los dos a la vez. La presencia es el
 * adaptador en memoria que exporta `@/data` sin credenciales.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { presence } from '@/data';
import { createMockSessionRepository } from '@/data/mock';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';
import { buildProfileInput } from '@/data/test-fixtures';

import {
  renderRoute,
  repositories,
  resetRepositories,
  resetRouter,
  router,
  setSearchParams,
} from '../routes';

import SessionScreen from '../../src/app/session/[sessionId]';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

const COUNTERPART_ID = SEED_RECIPROCAL_IDS[0];
const MINUTE = 60_000;
const BASE = Date.parse('2026-09-14T10:00:00.000Z');

/** Match con Núria y una sesión que empieza a BASE + 5 min + 1 s. */
async function seedSession({
  blocks = 2,
  accept = true,
}: { blocks?: 1 | 2 | 4; accept?: boolean } = {}) {
  await repositories.profiles.saveCurrent(buildProfileInput());
  const { match } = await repositories.discovery.recordDecision(COUNTERPART_ID, 'like');
  const startsAtMs = BASE + 5 * MINUTE + 1_000;
  const session = await repositories.sessions.propose({
    matchId: match!.id,
    startsAt: new Date(startsAtMs).toISOString(),
    blocks,
  });
  if (accept) await createMockSessionRepository(COUNTERPART_ID).respond(session.id, 'aceptada');
  setSearchParams({ sessionId: session.id });
  return { session, startsAtMs };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(BASE);
  resetRepositories();
  resetRouter();
  setSearchParams({});
});

afterEach(() => {
  jest.useRealTimers();
});

describe('SessionScreen', () => {
  it('con un id que no resuelve lo dice', async () => {
    setSearchParams({ sessionId: 'no-existe' });

    await renderRoute(<SessionScreen />);

    await waitFor(() => expect(screen.getByText('Esta sesión no está disponible')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Volver al chat' }));
    expect(router.back).toHaveBeenCalled();
  });

  it('una sesión sin aceptar no deja entrar', async () => {
    await seedSession({ accept: false });
    const join = jest.spyOn(repositories.sessions, 'join');

    await renderRoute(<SessionScreen />);

    await waitFor(() =>
      expect(screen.getByText('Esta sesión todavía no está aceptada')).toBeTruthy()
    );
    expect(join).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Volver al chat' }));
    expect(router.back).toHaveBeenCalled();
  });

  it('antes de que abra la ventana explica cuándo se puede entrar', async () => {
    await seedSession();
    const join = jest.spyOn(repositories.sessions, 'join');

    await renderRoute(<SessionScreen />);

    await waitFor(() => expect(screen.getByText('Todavía no puedes entrar')).toBeTruthy());
    expect(join).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Volver al chat' }));
    expect(router.back).toHaveBeenCalled();
  });

  it('dentro de la ventana entra, cuenta atrás y ve si la otra persona está', async () => {
    const { session, startsAtMs } = await seedSession();
    jest.setSystemTime(startsAtMs - 4 * MINUTE);
    const join = jest.spyOn(repositories.sessions, 'join');

    await renderRoute(<SessionScreen />);

    await waitFor(() => expect(screen.getByText('Empieza en')).toBeTruthy());
    expect(screen.getByText('4:00')).toBeTruthy();
    await waitFor(() => expect(join).toHaveBeenCalledWith(session.id));
    expect(screen.getByText('Aún no ha entrado')).toBeTruthy();

    let leave: () => void = () => {};
    await act(async () => {
      leave = presence.join(session.id, COUNTERPART_ID, {
        onPeers: () => {},
        onConnection: () => {},
      });
    });
    expect(screen.getByText('Está aquí')).toBeTruthy();
    leave();
  });

  it('en trabajo y en descanso nombra la fase y el bloque', async () => {
    const { startsAtMs } = await seedSession();
    jest.setSystemTime(startsAtMs + MINUTE);

    await renderRoute(<SessionScreen />);
    await waitFor(() => expect(screen.getByText('Trabajo · bloque 1 de 2')).toBeTruthy());
    expect(screen.getByText('24:00')).toBeTruthy();

    await act(async () => {
      jest.setSystemTime(startsAtMs + 26 * MINUTE);
      jest.advanceTimersByTime(1_000);
    });
    expect(screen.getByText('Descanso · bloque 1 de 2')).toBeTruthy();
  });

  it('al acabar la da por completada y vuelve al chat', async () => {
    const { startsAtMs } = await seedSession({ blocks: 1 });
    jest.setSystemTime(startsAtMs + 31 * MINUTE);

    await renderRoute(<SessionScreen />);

    await waitFor(() => expect(screen.getByText('Sesión completada')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Volver al chat' }));
    expect(router.back).toHaveBeenCalled();
  });

  it('salir pide confirmación, registra la salida y vuelve', async () => {
    const { session, startsAtMs } = await seedSession();
    jest.setSystemTime(startsAtMs + MINUTE);
    const join = jest.spyOn(repositories.sessions, 'join');
    const leave = jest.spyOn(repositories.sessions, 'leave');

    await renderRoute(<SessionScreen />);
    await waitFor(() => expect(join).toHaveBeenCalled());

    await fireEvent.press(screen.getByRole('button', { name: 'Salir' }));
    expect(screen.getByText('Saldrás antes de acabar; contará como abandono.')).toBeTruthy();
    expect(leave).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Seguir' }));
    expect(screen.queryByText('Saldrás antes de acabar; contará como abandono.')).toBeNull();
    expect(leave).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Salir' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salir de la sesión' }));

    await waitFor(() => expect(leave).toHaveBeenCalledWith(session.id));
    expect(router.back).toHaveBeenCalled();
  });
});
