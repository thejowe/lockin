/**
 * Pantalla de la sala Lock-In grupal.
 *
 * Reloj falso de Jest: el mock de salas y la pantalla leen `Date.now()`, así que
 * mover la hora del sistema mueve a los dos a la vez. Las demás personas son
 * repositorios de sala de otros actores sobre el mismo store, como en la suite
 * de contrato. La presencia es el adaptador en memoria (`roomPresence` sin
 * credenciales).
 *
 * Reparto: Núria (`seed-nuria`) y Alba (`seed-alba`) son matches del usuario
 * cuando convoca él; cuando convoca Núria, el usuario es Bea en el lenguaje de
 * la spec y Alba es Carla.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { roomPresence, SessionConflictError, SessionExpiredError } from '@/data';
import { createMockRoomRepository, defaultMockStore } from '@/data/mock';
import { buildProfileInput } from '@/data/test-fixtures';

import {
  renderRoute,
  repositories,
  resetRepositories,
  resetRouter,
  router,
  setSearchParams,
} from '../routes';

import RoomScreen from '../../src/app/room/[roomId]';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

const NURIA = 'seed-nuria';
const ALBA = 'seed-alba';
const MARC = 'seed-marc';
const MINUTE = 60_000;
const BASE = new Date(2026, 9, 3, 10, 0).getTime();
const STARTS_AT = BASE + 30 * MINUTE;

/** El usuario convoca a Núria y a Marc. */
async function seedAsHost(blocks: 1 | 2 | 4 = 2) {
  await repositories.profiles.saveCurrent(buildProfileInput({ name: 'Joel Torres' }));
  await repositories.discovery.recordDecision(NURIA, 'like');
  await repositories.discovery.recordDecision(MARC, 'like');
  const view = await repositories.rooms.create({
    inviteeIds: [NURIA, MARC],
    startsAt: new Date(STARTS_AT).toISOString(),
    blocks,
  });
  setSearchParams({ roomId: view.room.id });
  return view.room.id;
}

/** Núria convoca al usuario y a Alba, que es match suyo pero no del usuario. */
async function seedAsInvitee({
  meAccepts = false,
  albaAccepts = false,
}: { meAccepts?: boolean; albaAccepts?: boolean } = {}) {
  await repositories.profiles.saveCurrent(buildProfileInput({ name: 'Bea Puig' }));
  await repositories.discovery.recordDecision(NURIA, 'like');
  defaultMockStore.state.matches.push({
    id: 'match-nuria-alba',
    profileIds: [NURIA, ALBA],
    mode: 'lockin',
    createdAt: new Date(BASE).toISOString(),
    lastMessageAt: null,
  });
  const nuria = createMockRoomRepository(NURIA);
  const view = await nuria.create({
    inviteeIds: ['me', ALBA],
    startsAt: new Date(STARTS_AT).toISOString(),
    blocks: 2,
  });
  const roomId = view.room.id;
  if (meAccepts) await repositories.rooms.respond(roomId, 'aceptada');
  if (albaAccepts) await createMockRoomRepository(ALBA).respond(roomId, 'aceptada');
  setSearchParams({ roomId });
  return { roomId, nuria, alba: createMockRoomRepository(ALBA) };
}

const button = (name: string) => screen.getByRole('button', { name });

/**
 * El `onPress` del `Pressable` que pinta un botón, buscado como lo hace
 * `fireEvent`: subiendo por las fibras hasta el primer `onPress`.
 */
function pressHandler(element: ReturnType<typeof button>): () => void {
  type Fiber = { memoizedProps?: { onPress?: () => void } | null; return: Fiber | null };
  let fiber = (element as unknown as { unstable_fiber: Fiber | null }).unstable_fiber;
  while (fiber) {
    const onPress = fiber.memoizedProps?.onPress;
    if (onPress) return onPress;
    fiber = fiber.return;
  }
  throw new Error('el botón no tiene onPress');
}
const noButton = (name: string) => screen.queryByRole('button', { name });

/**
 * Retiene una escritura de las salas del usuario hasta que el test la suelta;
 * luego hace la escritura de verdad.
 */
function holdRooms<K extends 'respond' | 'cancel'>(method: K) {
  const rooms = repositories.rooms;
  const original = rooms[method].bind(rooms) as (...args: unknown[]) => Promise<unknown>;
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  const spy = jest
    .spyOn(rooms, method)
    .mockImplementation(((...args: unknown[]) => gate.then(() => original(...args))) as never);
  return { spy, release };
}

/**
 * Dos toques en el mismo instante, antes de que el botón se repinte, con la
 * escritura retenida: se comprueba antes y después de soltarla.
 */
async function doubleTap(name: string, release: () => void, beforeRelease?: () => void) {
  const onPress = pressHandler(button(name));
  const taps = act(async () => {
    onPress();
    onPress();
  });
  beforeRelease?.();
  release();
  await taps;
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

describe('RoomScreen — antes de la ventana', () => {
  it('una invitada ve quién convoca, no ve a la otra invitada y se apunta', async () => {
    const { roomId } = await seedAsInvitee();
    const respond = jest.spyOn(repositories.rooms, 'respond');

    await renderRoute(<RoomScreen />);

    await waitFor(() => expect(screen.getByText('Convoca Núria')).toBeTruthy());
    expect(screen.getByText('Núria Bosch')).toBeTruthy();
    expect(screen.queryByText('Alba Ferrer')).toBeNull();
    expect(screen.queryByText(/anfitri|organiza|admin/i)).toBeNull();
    expect(button('No puedo')).toBeTruthy();

    // El doble toque (una sola escritura) lo fija `use-room.test.tsx`.
    await fireEvent.press(button('Me apunto'));

    await waitFor(() => expect(button('No podré ir')).toBeTruthy());
    expect(respond).toHaveBeenCalledTimes(1);
    expect(respond).toHaveBeenCalledWith(roomId, 'aceptada');
    expect(noButton('Me apunto')).toBeNull();
    expect(noButton('Cancelar sala')).toBeNull();
  });

  it('quien convoca ve a todo el mundo con su estado, y cancela tras confirmar', async () => {
    const roomId = await seedAsHost();
    await createMockRoomRepository(NURIA).respond(roomId, 'aceptada');
    const cancel = jest.spyOn(repositories.rooms, 'cancel');

    await renderRoute(<RoomScreen />);

    await waitFor(() => expect(screen.getByText('Convocas tú')).toBeTruthy());
    expect(screen.getByText('Núria Bosch')).toBeTruthy();
    expect(screen.getByText('Ha aceptado')).toBeTruthy();
    expect(screen.getByText('Marc Oller')).toBeTruthy();
    expect(screen.getByText('Invitada')).toBeTruthy();
    expect(noButton('Me apunto')).toBeNull();

    await fireEvent.press(button('Cancelar sala'));
    expect(screen.getByText('Se cancelará para todas las personas invitadas.')).toBeTruthy();
    expect(cancel).not.toHaveBeenCalled();
    await fireEvent.press(button('No, mantenerla'));
    expect(screen.queryByText('Se cancelará para todas las personas invitadas.')).toBeNull();

    await fireEvent.press(button('Cancelar sala'));
    await fireEvent.press(button('Sí, cancelar la sala'));

    await waitFor(() => expect(screen.getByText('Cancelaste la sala')).toBeTruthy());
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('quien convoca ve «No podrá ir» de quien rechaza', async () => {
    const roomId = await seedAsHost();
    await createMockRoomRepository(MARC).respond(roomId, 'rechazada');

    await renderRoute(<RoomScreen />);

    await waitFor(() => expect(screen.getByText('No podrá ir')).toBeTruthy());
  });

  it('una aceptada que no podrá ir confirma, rechaza y vuelve sin pintar «no disponible»', async () => {
    const { roomId } = await seedAsInvitee({ meAccepts: true });
    const respond = jest.spyOn(repositories.rooms, 'respond');

    await renderRoute(<RoomScreen />);
    await waitFor(() => expect(button('No podré ir')).toBeTruthy());

    await fireEvent.press(button('No podré ir'));
    expect(respond).not.toHaveBeenCalled();
    await fireEvent.press(button('Sí, no podré ir'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(respond).toHaveBeenCalledWith(roomId, 'rechazada');
    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });
    expect(screen.queryByText('Esta sala no está disponible')).toBeNull();
    await expect(repositories.rooms.getById(roomId)).resolves.toBeNull();
  });

  it('una invitada que no puede rechaza sin confirmar y vuelve', async () => {
    const { roomId } = await seedAsInvitee();

    await renderRoute(<RoomScreen />);
    await waitFor(() => expect(button('No puedo')).toBeTruthy());
    await fireEvent.press(button('No puedo'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(screen.queryByText('Esta sala no está disponible')).toBeNull();
    await expect(repositories.rooms.getById(roomId)).resolves.toBeNull();
  });

  it('si la sala se cancela con la pantalla abierta, lo dice', async () => {
    const { roomId, nuria } = await seedAsInvitee({ meAccepts: true });

    await renderRoute(<RoomScreen />);
    await waitFor(() => expect(screen.getByText('Convoca Núria')).toBeTruthy());

    await act(async () => {
      await nuria.cancel(roomId);
    });

    await waitFor(() => expect(screen.getByText('Núria canceló la sala')).toBeTruthy());
    expect(noButton('No podré ir')).toBeNull();
  });

  it('si quien convocó borró su cuenta, la sala cancelada lo dice sin nombre ni crashear', async () => {
    const { roomId } = await seedAsInvitee({ meAccepts: true });
    const room = defaultMockStore.state.rooms.find((candidate) => candidate.id === roomId)!;
    room.hostId = null;
    room.cancelledAt = new Date(BASE).toISOString();

    await renderRoute(<RoomScreen />);

    await waitFor(() =>
      expect(screen.getByText('Se canceló la sala: quien la convocó ya no está')).toBeTruthy()
    );
    expect(noButton('No podré ir')).toBeNull();
  });

  it('sin convocante y sin cancelar, el título es neutro y nadie ve «Cancelar»', async () => {
    const { roomId } = await seedAsInvitee({ meAccepts: true });
    defaultMockStore.state.rooms.find((candidate) => candidate.id === roomId)!.hostId = null;

    await renderRoute(<RoomScreen />);

    await waitFor(() => expect(screen.getByText('Convoca alguien que ya no está')).toBeTruthy());
    expect(noButton('Cancelar sala')).toBeNull();
  });

  it('con la pantalla abierta, quien rechaza tras aceptar desaparece', async () => {
    const { roomId, alba } = await seedAsInvitee({ meAccepts: true, albaAccepts: true });

    await renderRoute(<RoomScreen />);
    await waitFor(() => expect(screen.getByText('Alba Ferrer')).toBeTruthy());

    await act(async () => {
      await alba.respond(roomId, 'rechazada');
    });

    await waitFor(() => expect(screen.queryByText('Alba Ferrer')).toBeNull());
    expect(screen.getByText('Núria Bosch')).toBeTruthy();
  });

  it('aceptar una sala que se acaba de cancelar lo explica', async () => {
    await seedAsInvitee();
    jest
      .spyOn(repositories.rooms, 'respond')
      .mockRejectedValueOnce(new SessionConflictError('cancelada'));

    await renderRoute(<RoomScreen />);
    await waitFor(() => expect(button('Me apunto')).toBeTruthy());
    await fireEvent.press(button('Me apunto'));

    await waitFor(() => expect(screen.getByText('La sala se acaba de cancelar.')).toBeTruthy());
  });

  it('responder cuando ya abrió la ventana lo explica', async () => {
    await seedAsInvitee();
    jest
      .spyOn(repositories.rooms, 'respond')
      .mockRejectedValueOnce(new SessionExpiredError('ventana abierta'));

    await renderRoute(<RoomScreen />);
    await waitFor(() => expect(button('Me apunto')).toBeTruthy());
    await fireEvent.press(button('Me apunto'));

    await waitFor(() =>
      expect(screen.getByText('Ya no se puede responder a esta sala.')).toBeTruthy()
    );
  });

  it('dos toques en «Me apunto» son una sola respuesta', async () => {
    const { roomId } = await seedAsInvitee();
    const { spy, release } = holdRooms('respond');

    await renderRoute(<RoomScreen />);
    await waitFor(() => expect(button('Me apunto')).toBeTruthy());
    await doubleTap('Me apunto', release);

    await waitFor(() => expect(button('No podré ir')).toBeTruthy());
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(roomId, 'aceptada');
  });

  it('dos toques en «No puedo»: un rechazo y un solo atrás, después de guardarlo', async () => {
    const { roomId } = await seedAsInvitee();
    const { spy, release } = holdRooms('respond');

    await renderRoute(<RoomScreen />);
    await waitFor(() => expect(button('No puedo')).toBeTruthy());
    await doubleTap('No puedo', release, () => expect(router.back).not.toHaveBeenCalled());

    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1);
    await expect(repositories.rooms.getById(roomId)).resolves.toBeNull();
  });

  it('dos toques en «Sí, no podré ir»: un rechazo y un solo atrás, después de guardarlo', async () => {
    const { roomId } = await seedAsInvitee({ meAccepts: true });
    const { spy, release } = holdRooms('respond');

    await renderRoute(<RoomScreen />);
    await waitFor(() => expect(button('No podré ir')).toBeTruthy());
    await fireEvent.press(button('No podré ir'));
    await doubleTap('Sí, no podré ir', release, () => expect(router.back).not.toHaveBeenCalled());

    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1);
    await expect(repositories.rooms.getById(roomId)).resolves.toBeNull();
  });

  it('si sale de la pantalla mientras rechaza, el rechazo se guarda pero no navega', async () => {
    const { roomId } = await seedAsInvitee();
    const { spy, release } = holdRooms('respond');

    const { unmount } = await renderRoute(<RoomScreen />);
    await waitFor(() => expect(button('No puedo')).toBeTruthy());
    const onPress = pressHandler(button('No puedo'));
    const tap = act(async () => {
      onPress();
    });
    await unmount();
    release();
    await tap;
    await act(async () => {});

    expect(spy).toHaveBeenCalledTimes(1);
    expect(router.back).not.toHaveBeenCalled();
    await expect(repositories.rooms.getById(roomId)).resolves.toBeNull();
  });

  it('si «No podré ir» falla se queda, lo dice y deja reintentar', async () => {
    await seedAsInvitee({ meAccepts: true });
    jest.spyOn(repositories.rooms, 'respond').mockRejectedValueOnce(new Error('sin red'));

    await renderRoute(<RoomScreen />);
    await waitFor(() => expect(button('No podré ir')).toBeTruthy());
    await fireEvent.press(button('No podré ir'));
    await fireEvent.press(button('Sí, no podré ir'));

    await waitFor(() =>
      expect(screen.getByText('No se ha podido guardar. Inténtalo de nuevo.')).toBeTruthy()
    );
    expect(router.back).not.toHaveBeenCalled();
    expect(button('No podré ir').props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('dos toques en «Sí, cancelar la sala» son una sola cancelación', async () => {
    const roomId = await seedAsHost();
    const { spy, release } = holdRooms('cancel');

    await renderRoute(<RoomScreen />);
    await waitFor(() => expect(button('Cancelar sala')).toBeTruthy());
    await fireEvent.press(button('Cancelar sala'));
    await doubleTap('Sí, cancelar la sala', release);

    await waitFor(() => expect(screen.getByText('Cancelaste la sala')).toBeTruthy());
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(roomId);
  });

  it('un fallo cualquiera deja reintentar', async () => {
    await seedAsInvitee();
    jest.spyOn(repositories.rooms, 'respond').mockRejectedValueOnce(new Error('sin red'));

    await renderRoute(<RoomScreen />);
    await waitFor(() => expect(button('No puedo')).toBeTruthy());
    await fireEvent.press(button('No puedo'));

    await waitFor(() =>
      expect(screen.getByText('No se ha podido guardar. Inténtalo de nuevo.')).toBeTruthy()
    );
    expect(router.back).not.toHaveBeenCalled();
    expect(button('No puedo')).toBeTruthy();
  });
});

describe('RoomScreen — ventana de entrada', () => {
  it('una invitada sin responder ya no puede responder', async () => {
    await seedAsInvitee();
    jest.setSystemTime(STARTS_AT - 4 * MINUTE);
    const join = jest.spyOn(repositories.rooms, 'join');

    await renderRoute(<RoomScreen />);

    await waitFor(() =>
      expect(screen.getByText('Ya no se puede responder a esta sala')).toBeTruthy()
    );
    expect(noButton('Me apunto')).toBeNull();
    expect(noButton('No puedo')).toBeNull();
    expect(join).not.toHaveBeenCalled();
  });

  it('una aceptada entra, ve la cuenta atrás y quién está, sin «No podré ir»', async () => {
    const { roomId } = await seedAsInvitee({ meAccepts: true, albaAccepts: true });
    jest.setSystemTime(STARTS_AT - 4 * MINUTE);
    const join = jest.spyOn(repositories.rooms, 'join');

    await renderRoute(<RoomScreen />);

    await waitFor(() => expect(screen.getByText('Empieza en')).toBeTruthy());
    expect(screen.getByText('4:00')).toBeTruthy();
    await waitFor(() => expect(join).toHaveBeenCalledWith(roomId));
    expect(noButton('No podré ir')).toBeNull();
    expect(screen.getAllByText('Aún no ha entrado')).toHaveLength(2);

    let leave: () => void = () => {};
    await act(async () => {
      leave = roomPresence.join(roomId, NURIA, { onPeers: () => {}, onConnection: () => {} });
    });
    expect(screen.getByText('Está aquí')).toBeTruthy();
    expect(screen.getAllByText('Aún no ha entrado')).toHaveLength(1);
    await act(async () => leave());
    expect(screen.getAllByText('Aún no ha entrado')).toHaveLength(2);
  });

  it('en trabajo nombra la fase y el bloque', async () => {
    await seedAsHost();
    jest.setSystemTime(STARTS_AT + MINUTE);

    await renderRoute(<RoomScreen />);

    await waitFor(() => expect(screen.getByText('Trabajo · bloque 1 de 2')).toBeTruthy());
    expect(screen.getByText('24:00')).toBeTruthy();
    // Ya empezada, quien convoca no puede cancelar.
    expect(noButton('Cancelar sala')).toBeNull();
  });

  it('quien convoca puede cancelar dentro de la ventana mientras no empiece', async () => {
    await seedAsHost();
    jest.setSystemTime(STARTS_AT - 2 * MINUTE);

    await renderRoute(<RoomScreen />);

    await waitFor(() => expect(screen.getByText('Empieza en')).toBeTruthy());
    await fireEvent.press(button('Cancelar sala'));
    await fireEvent.press(button('Sí, cancelar la sala'));
    await waitFor(() => expect(screen.getByText('Cancelaste la sala')).toBeTruthy());
  });

  /** `join` retenido hasta que el test lo suelta; luego hace la escritura de verdad. */
  function holdJoin() {
    const original = repositories.rooms.join;
    let release!: () => void;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    const join = jest
      .spyOn(repositories.rooms, 'join')
      .mockImplementation((id) => gate.then(() => original(id)));
    return { join, release };
  }

  it('salir atrás con la entrada aún en vuelo registra la salida cuando la entrada llega', async () => {
    const roomId = await seedAsHost();
    jest.setSystemTime(STARTS_AT + MINUTE);
    const { join, release } = holdJoin();
    const leave = jest.spyOn(repositories.rooms, 'leave');

    const { unmount } = await renderRoute(<RoomScreen />);
    await waitFor(() => expect(join).toHaveBeenCalledTimes(1));
    await unmount();
    expect(leave).not.toHaveBeenCalled();

    await act(async () => release());

    await waitFor(() => expect(leave).toHaveBeenCalledTimes(1));
    expect(leave).toHaveBeenCalledWith(roomId);
    const view = await repositories.rooms.getById(roomId);
    expect(view!.me.joinedAt).not.toBeNull();
    expect(view!.me.leftAt).not.toBeNull();
  });

  it('«Salir» con la entrada aún en vuelo espera a la entrada y sale una vez', async () => {
    const roomId = await seedAsHost();
    jest.setSystemTime(STARTS_AT + MINUTE);
    const { join, release } = holdJoin();
    const leave = jest.spyOn(repositories.rooms, 'leave');

    const { unmount } = await renderRoute(<RoomScreen />);
    await waitFor(() => expect(join).toHaveBeenCalledTimes(1));
    await fireEvent.press(button('Salir'));
    const confirmed = fireEvent.press(button('Salir de la sala'));
    release();
    await confirmed;

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    await unmount();
    await act(async () => {});
    expect(leave).toHaveBeenCalledTimes(1);
    const view = await repositories.rooms.getById(roomId);
    expect(view!.me.leftAt).not.toBeNull();
  });

  it('dos toques en «Salir de la sala» con la salida en vuelo: una salida y un solo atrás', async () => {
    await seedAsHost();
    jest.setSystemTime(STARTS_AT + MINUTE);
    const join = jest.spyOn(repositories.rooms, 'join');
    const original = repositories.rooms.leave;
    let release!: () => void;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    const leave = jest
      .spyOn(repositories.rooms, 'leave')
      .mockImplementation((id) => gate.then(() => original(id)));

    await renderRoute(<RoomScreen />);
    await waitFor(() => expect(join).toHaveBeenCalled());
    await fireEvent.press(button('Salir'));

    // Los dos toques en el mismo instante, antes de que la pantalla repinte, y
    // en un solo `act` (dos `fireEvent` solapados rompen el entorno de act).
    const onPress = pressHandler(button('Salir de la sala'));
    const taps = act(async () => {
      onPress();
      onPress();
    });
    expect(router.back).not.toHaveBeenCalled();
    release();
    await taps;

    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('si sale de la pantalla mientras registra la salida, la registra pero no navega', async () => {
    const roomId = await seedAsHost();
    jest.setSystemTime(STARTS_AT + MINUTE);
    const join = jest.spyOn(repositories.rooms, 'join');
    const original = repositories.rooms.leave;
    let release!: () => void;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    const leave = jest
      .spyOn(repositories.rooms, 'leave')
      .mockImplementation((id) => gate.then(() => original(id)));

    const { unmount } = await renderRoute(<RoomScreen />);
    await waitFor(() => expect(join).toHaveBeenCalled());
    await fireEvent.press(button('Salir'));
    const onPress = pressHandler(button('Salir de la sala'));
    const tap = act(async () => {
      onPress();
    });
    await unmount();
    release();
    await tap;
    await act(async () => {});

    expect(leave).toHaveBeenCalledTimes(1);
    expect(router.back).not.toHaveBeenCalled();
    const view = await repositories.rooms.getById(roomId);
    expect(view!.me.leftAt).not.toBeNull();
  });

  it('una vez pulsada, la confirmación de salida queda deshabilitada', async () => {
    await seedAsHost();
    jest.setSystemTime(STARTS_AT + MINUTE);
    const join = jest.spyOn(repositories.rooms, 'join');

    await renderRoute(<RoomScreen />);
    await waitFor(() => expect(join).toHaveBeenCalled());
    await fireEvent.press(button('Salir'));
    await fireEvent.press(button('Salir de la sala'));

    // El router de los tests no desmonta la pantalla: se ve el botón tras salir.
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(button('Salir de la sala').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('salir pide confirmación, registra la salida y vuelve', async () => {
    const roomId = await seedAsHost();
    jest.setSystemTime(STARTS_AT + MINUTE);
    const join = jest.spyOn(repositories.rooms, 'join');
    const leave = jest.spyOn(repositories.rooms, 'leave');

    await renderRoute(<RoomScreen />);
    await waitFor(() => expect(join).toHaveBeenCalled());

    await fireEvent.press(button('Salir'));
    expect(screen.getByText('Saldrás antes de acabar.')).toBeTruthy();
    await fireEvent.press(button('Seguir'));
    expect(screen.queryByText('Saldrás antes de acabar.')).toBeNull();
    expect(leave).not.toHaveBeenCalled();

    await fireEvent.press(button('Salir'));
    await fireEvent.press(button('Salir de la sala'));

    await waitFor(() => expect(leave).toHaveBeenCalledWith(roomId));
    expect(router.back).toHaveBeenCalled();
  });

  it('el gesto atrás también registra la salida', async () => {
    const roomId = await seedAsHost();
    jest.setSystemTime(STARTS_AT + MINUTE);
    const join = jest.spyOn(repositories.rooms, 'join');
    const leave = jest.spyOn(repositories.rooms, 'leave');

    const { unmount } = await renderRoute(<RoomScreen />);
    await waitFor(() => expect(join).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Trabajo · bloque 1 de 2')).toBeTruthy());
    await unmount();

    expect(leave).toHaveBeenCalledWith(roomId);
  });

  it('si entrar falla, lo reintenta', async () => {
    await seedAsHost();
    jest.setSystemTime(STARTS_AT + MINUTE);
    const join = jest.spyOn(repositories.rooms, 'join').mockRejectedValueOnce(new Error('sin red'));

    await renderRoute(<RoomScreen />);
    await waitFor(() => expect(join).toHaveBeenCalledTimes(1));
    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });

    await waitFor(() => expect(join).toHaveBeenCalledTimes(2));
  });
});

describe('RoomScreen — final y casos raros', () => {
  it('terminada: completada, sin valoración, y vuelta a Matches', async () => {
    await seedAsHost(1);
    jest.setSystemTime(STARTS_AT + 31 * MINUTE);

    await renderRoute(<RoomScreen />);

    await waitFor(() => expect(screen.getByText('Sala completada')).toBeTruthy());
    expect(button('Volver a Matches')).toBeTruthy();
    expect(screen.queryByText('¿Qué tal ha ido?')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('terminada sin haberte apuntado no la da por completada', async () => {
    await seedAsInvitee();
    jest.setSystemTime(STARTS_AT + 61 * MINUTE);

    await renderRoute(<RoomScreen />);

    await waitFor(() => expect(screen.getByText('Esta sala ya terminó')).toBeTruthy());
  });

  it('una sala ajena o inexistente no está disponible', async () => {
    setSearchParams({ roomId: 'no-existe' });

    await renderRoute(<RoomScreen />);

    await waitFor(() => expect(screen.getByText('Esta sala no está disponible')).toBeTruthy());
    expect(button('Volver a Matches')).toBeTruthy();
  });

  it('un id repetido en la URL usa el primero', async () => {
    const roomId = await seedAsHost();
    setSearchParams({ roomId: [roomId, 'otro'] });

    await renderRoute(<RoomScreen />);

    await waitFor(() => expect(screen.getByText('Convocas tú')).toBeTruthy());
  });

  it('si la lectura falla lo dice y deja reintentar', async () => {
    const roomId = await seedAsHost();
    const getById = jest
      .spyOn(repositories.rooms, 'getById')
      .mockRejectedValueOnce(new Error('sin red'));

    await renderRoute(<RoomScreen />);

    await waitFor(() => expect(screen.getByText('No se ha podido cargar la sala')).toBeTruthy());
    await fireEvent.press(button('Reintentar'));
    await waitFor(() => expect(screen.getByText('Convocas tú')).toBeTruthy());
    expect(getById).toHaveBeenLastCalledWith(roomId);
  });
});
