/**
 * Pantalla «Convocar sala Lock-In».
 *
 * El mock con dos o tres matches recíprocos hechos con `recordDecision`. Bajo
 * Jest los perfiles semilla no aceptan solos, así que la sala nace con las
 * invitadas `invitada`.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { RoomInviteError, SessionWindowError } from '@/data';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';
import { buildProfileInput } from '@/data/test-fixtures';

import { renderRoute, repositories, resetRepositories, resetRouter, router } from '../routes';

import NewRoomScreen from '../../src/app/room/new';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

const BASE = new Date(2026, 9, 3, 10, 2).getTime();

/** El perfil propio y un match con cada uno de los `count` primeros perfiles semilla. */
async function seedMatches(count: number) {
  await repositories.profiles.saveCurrent(buildProfileInput());
  const names: string[] = [];
  for (const id of SEED_RECIPROCAL_IDS.slice(0, count)) {
    await repositories.discovery.recordDecision(id, 'like');
    names.push((await repositories.profiles.getById(id))!.name);
  }
  return names;
}

const convocar = () => screen.getByRole('button', { name: 'Convocar' });

/** El `onPress` del `Pressable` de un botón, buscado como lo hace `fireEvent`. */
function pressHandler(element: ReturnType<typeof convocar>): () => void {
  type Fiber = { memoizedProps?: { onPress?: () => void } | null; return: Fiber | null };
  let fiber = (element as unknown as { unstable_fiber: Fiber | null }).unstable_fiber;
  while (fiber) {
    const onPress = fiber.memoizedProps?.onPress;
    if (onPress) return onPress;
    fiber = fiber.return;
  }
  throw new Error('el botón no tiene onPress');
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(BASE);
  resetRepositories();
  resetRouter();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('NewRoomScreen', () => {
  it('presenta las tres preguntas sin ningún campo de texto', async () => {
    await seedMatches(2);

    await renderRoute(<NewRoomScreen />);

    await waitFor(() => expect(screen.getByText('Convocar sala Lock-In')).toBeTruthy());
    expect(screen.getByText('Con quién')).toBeTruthy();
    expect(screen.getByText('Cuándo')).toBeTruthy();
    expect(screen.getByText('Cuánto')).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).not.toContain('"type":"TextInput"');
  });

  it('preselecciona el próximo tramo válido de hoy', async () => {
    await seedMatches(2);

    await renderRoute(<NewRoomScreen />);

    // 10:02 + 5 min de antelación mínima: el primer tramo es 10:15.
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Hora 10:15' }).props.accessibilityState
      ).toMatchObject({ selected: true })
    );
    expect(screen.getByRole('button', { name: 'Día Hoy' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(
      screen.getByRole('button', { name: '2 bloques, hasta 11:15' }).props.accessibilityState
    ).toMatchObject({ selected: true });
  });

  it('si hoy ya no queda ningún tramo, salta a mañana', async () => {
    jest.setSystemTime(new Date(2026, 9, 3, 23, 50).getTime());
    await seedMatches(2);

    await renderRoute(<NewRoomScreen />);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Día Mañana' }).props.accessibilityState
      ).toMatchObject({ selected: true })
    );
    expect(screen.queryByRole('button', { name: 'Día Hoy' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Hora 00:00' }).props.accessibilityState
    ).toMatchObject({ selected: true });
  });

  it('«Convocar» espera a tener 2 personas marcadas', async () => {
    const [first, second] = await seedMatches(2);

    await renderRoute(<NewRoomScreen />);
    await waitFor(() => expect(screen.getByRole('checkbox', { name: first })).toBeTruthy());

    expect(convocar().props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByRole('checkbox', { name: first }));
    expect(convocar().props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByRole('checkbox', { name: second }));
    expect(convocar().props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('convoca una sola vez aunque se toque dos veces, y sustituye la ruta por la sala', async () => {
    const [first, second] = await seedMatches(3);
    // La escritura se retiene: los dos toques llegan con la primera en vuelo.
    const original = repositories.rooms.create;
    let release!: () => void;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    const create = jest
      .spyOn(repositories.rooms, 'create')
      .mockImplementation((input) => gate.then(() => original(input)));

    await renderRoute(<NewRoomScreen />);
    await waitFor(() => expect(screen.getByRole('checkbox', { name: first })).toBeTruthy());
    await fireEvent.press(screen.getByRole('checkbox', { name: first }));
    await fireEvent.press(screen.getByRole('checkbox', { name: second }));
    await fireEvent.press(screen.getByRole('button', { name: '1 bloque, hasta 10:45' }));

    // Dos toques en el mismo instante, en un solo `act`.
    const onPress = pressHandler(convocar());
    const taps = act(async () => {
      onPress();
      onPress();
    });
    expect(router.replace).not.toHaveBeenCalled();
    release();
    await taps;

    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      inviteeIds: SEED_RECIPROCAL_IDS.slice(0, 2),
      startsAt: new Date(2026, 9, 3, 10, 15).toISOString(),
      blocks: 1,
    });
    const [live] = await repositories.rooms.listLive();
    expect(router.replace).toHaveBeenCalledWith(`/room/${live.room.id}`);
  });

  it('con menos de 2 matches no deja convocar y manda a Descubrir', async () => {
    await seedMatches(1);

    await renderRoute(<NewRoomScreen />);

    await waitFor(() =>
      expect(screen.getByText('Necesitas al menos 2 matches para convocar una sala')).toBeTruthy()
    );
    expect(screen.getByRole('button', { name: 'Ir a Descubrir' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Convocar' })).toBeNull();
  });

  it('un rechazo de invitados sale como texto y deja volver a intentarlo', async () => {
    const [first, second] = await seedMatches(2);
    jest
      .spyOn(repositories.rooms, 'create')
      .mockRejectedValueOnce(new RoomInviteError('Solo puedes invitar a tus matches.'));

    await renderRoute(<NewRoomScreen />);
    await waitFor(() => expect(screen.getByRole('checkbox', { name: first })).toBeTruthy());
    await fireEvent.press(screen.getByRole('checkbox', { name: first }));
    await fireEvent.press(screen.getByRole('checkbox', { name: second }));
    await fireEvent.press(convocar());

    await waitFor(() =>
      expect(screen.getByText('Solo puedes invitar a tus matches.')).toBeTruthy()
    );
    expect(router.replace).not.toHaveBeenCalled();
    expect(convocar().props.accessibilityState).toMatchObject({ disabled: false });

    await fireEvent.press(convocar());
    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
  });

  it('una hora que ya no vale pide elegir otra', async () => {
    const [first, second] = await seedMatches(2);
    jest
      .spyOn(repositories.rooms, 'create')
      .mockRejectedValueOnce(new SessionWindowError('fuera de rango'));

    await renderRoute(<NewRoomScreen />);
    await waitFor(() => expect(screen.getByRole('checkbox', { name: first })).toBeTruthy());
    await fireEvent.press(screen.getByRole('checkbox', { name: first }));
    await fireEvent.press(screen.getByRole('checkbox', { name: second }));
    await fireEvent.press(convocar());

    await waitFor(() =>
      expect(screen.getByText('Esa hora ya no está disponible. Elige otra.')).toBeTruthy()
    );
  });

  it('cualquier otro fallo no rompe la pantalla', async () => {
    const [first, second] = await seedMatches(2);
    jest.spyOn(repositories.rooms, 'create').mockRejectedValueOnce(new Error('sin red'));

    await renderRoute(<NewRoomScreen />);
    await waitFor(() => expect(screen.getByRole('checkbox', { name: first })).toBeTruthy());
    await fireEvent.press(screen.getByRole('checkbox', { name: second }));
    await fireEvent.press(screen.getByRole('checkbox', { name: first }));
    await fireEvent.press(convocar());

    await waitFor(() =>
      expect(screen.getByText('No se ha podido convocar. Inténtalo de nuevo.')).toBeTruthy()
    );
  });

  it('cambiar de día conserva la hora si ese día la tiene', async () => {
    await seedMatches(2);

    await renderRoute(<NewRoomScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Hora 10:15' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Hora 10:30' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Día Mañana' }));

    expect(
      screen.getByRole('button', { name: 'Hora 10:30' }).props.accessibilityState
    ).toMatchObject({ selected: true });
    expect(screen.getByRole('button', { name: 'Hora 00:00' })).toBeTruthy();
  });

  it('si los matches no cargan lo dice', async () => {
    jest.spyOn(repositories.matches, 'list').mockRejectedValue(new Error('sin red'));

    await renderRoute(<NewRoomScreen />);

    await waitFor(() =>
      expect(screen.getByText('No hemos podido cargar tus matches')).toBeTruthy()
    );
  });
});
