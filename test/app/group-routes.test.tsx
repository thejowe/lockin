/**
 * Las tres rutas de los grupos —crear (`/group/new`), «Tu grupo» (`/group/info`)
 * y el chat (`/group/[groupId]`)— y las piezas que montan: el formulario, la
 * gestión de miembros y la conversación.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { TERMS_VERSION } from '@/constants/legal';
import { GroupError, PremiumRequiredError } from '@/data';
import { createMockRepositories, defaultMockStore } from '@/data/mock';
import { buildProfileInput } from '@/data/test-fixtures';
import { groupErrorMessage, memberRoleLabel } from '@/features/groups';

import {
  renderRoute,
  repositories,
  resetRepositories,
  resetRouter,
  router,
  setSearchParams,
} from '../routes';

import GroupChatScreen from '../../src/app/group/[groupId]';
import GroupInfoRoute from '../../src/app/group/info';
import NewGroupRoute from '../../src/app/group/new';

import type { GroupInput, Specialty } from '@/data';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

const INPUT: GroupInput = {
  name: 'Mi Equipo',
  description: 'Un proyecto de prueba con descripción.',
  roles: [{ specialty: 'dev', slots: 2 }],
};
const TALLER = 'seed-group-taller';

const as = (actorId: string) => createMockRepositories(defaultMockStore, { actorId });

async function withProfile(specialties: Specialty[] = ['dev']) {
  await repositories.profiles.saveCurrent(buildProfileInput({ name: 'Yo Misma', specialties }));
}

/** La cuenta propia administra un grupo en el que ya ha entrado Inés. */
async function adminWithMember() {
  await withProfile(['producto']);
  const view = await repositories.groups.create(INPUT);
  await as('seed-ines').groups.swipeGroup(view.group.id, 'like');
  await repositories.groups.swipeCandidate('seed-ines', view.roles[0].id, 'like');
  return view.group.id;
}

beforeEach(() => {
  resetRepositories();
  resetRouter();
  setSearchParams({});
});

describe('textos', () => {
  it('cada fallo tiene su mensaje', () => {
    const messages = [
      groupErrorMessage(new PremiumRequiredError()),
      groupErrorMessage(new GroupError('already-in-group', '')),
      groupErrorMessage(new GroupError('admin-only', '')),
      groupErrorMessage(new GroupError('unavailable', '')),
      groupErrorMessage(new GroupError('candidate-unavailable', '')),
      groupErrorMessage(new GroupError('invalid', '')),
      groupErrorMessage(new Error('otra cosa')),
    ];
    expect(new Set(messages).size).toBe(messages.length);
    expect(messages[0]).toBe('Crear un grupo requiere Premium.');
  });

  it('el cargo de cada miembro', () => {
    expect(memberRoleLabel({ specialty: null, isAdmin: true })).toBe('Admin');
    expect(memberRoleLabel({ specialty: 'dev', isAdmin: true })).toBe('Admin · Desarrollo');
    expect(memberRoleLabel({ specialty: 'dev', isAdmin: false })).toBe('Desarrollo');
    expect(memberRoleLabel({ specialty: null, isAdmin: false })).toBe('Miembro');
  });
});

describe('/group/new', () => {
  async function fill() {
    await fireEvent.changeText(screen.getByLabelText('Nombre del grupo'), 'Mi Equipo');
    await fireEvent.changeText(
      screen.getByLabelText('Descripción del proyecto'),
      'Queremos construir algo grande.'
    );
  }

  it('no crea nada hasta que los datos valen, y dice qué falta', async () => {
    await withProfile();
    const create = jest.spyOn(repositories.groups, 'create');
    await renderRoute(<NewGroupRoute />);

    await fireEvent.press(screen.getByRole('button', { name: 'Crear grupo' }));

    expect(screen.getByText('El nombre necesita entre 2 y 60 caracteres.')).toBeTruthy();
    expect(screen.getByText('Cuenta el proyecto en al menos 10 caracteres.')).toBeTruthy();
    expect(screen.getByText('Elige al menos un puesto.')).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
  });

  it('se eligen puestos y plazas, sin pasar de cinco entre todos', async () => {
    await withProfile();
    await renderRoute(<NewGroupRoute />);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Puesto: Desarrollo' }));
    expect(screen.getByText('1 plaza')).toBeTruthy();
    for (let i = 0; i < 3; i += 1) {
      await fireEvent.press(screen.getByRole('button', { name: 'Sumar' }));
    }
    expect(screen.getByText('4 plazas')).toBeTruthy();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Puesto: Diseño' }));
    expect(screen.getByText(/Te quedan 0/)).toBeTruthy();
    // Sin sitio, un tercer puesto no se añade.
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Puesto: Marketing' }));
    expect(screen.queryByText('Marketing', { exact: true })).toBeTruthy();
    expect(screen.getAllByText('1 plaza')).toHaveLength(1);

    // Quitar un puesto devuelve su sitio.
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Puesto: Diseño' }));
    expect(screen.getByText(/Te quedan 1/)).toBeTruthy();
  });

  it('crea el grupo y vuelve: quien lo crea lo administra', async () => {
    await withProfile();
    await renderRoute(<NewGroupRoute />);
    await fill();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Puesto: Desarrollo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Sumar' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Crear grupo' }));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const view = (await repositories.groups.getMine())!;
    expect(view.isAdmin).toBe(true);
    expect(view.group.name).toBe('Mi Equipo');
    expect(view.roles.map((role) => [role.specialty, role.slots])).toEqual([['dev', 2]]);
  });

  it('sin historial vuelve a Descubrir, y un rechazo del servidor se explica', async () => {
    await withProfile();
    router.canGoBack.mockReturnValue(false);
    jest
      .spyOn(repositories.groups, 'create')
      .mockRejectedValueOnce(new GroupError('already-in-group', 'ya'));
    await renderRoute(<NewGroupRoute />);
    await fill();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Puesto: Desarrollo' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Crear grupo' }));
    await waitFor(() => expect(screen.getByText(/Ya estás en un grupo/)).toBeTruthy());
    expect(router.replace).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Crear grupo' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/discover'));
  });
});

describe('/group/info', () => {
  it('sin grupo lo dice y deja volver', async () => {
    await withProfile();
    await renderRoute(<GroupInfoRoute />);

    await waitFor(() => expect(screen.getByText('Ya no estás en ningún grupo')).toBeTruthy());
    expect(screen.getByText('Busca uno en Descubrir o crea el tuyo.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(router.back).toHaveBeenCalled();
  });

  it('si falla la carga, lo cuenta como fallo', async () => {
    await withProfile();
    router.canGoBack.mockReturnValue(false);
    jest.spyOn(repositories.groups, 'getMine').mockRejectedValue(new Error('sin red'));
    await renderRoute(<GroupInfoRoute />);

    await waitFor(() => expect(screen.getByText(/Ha fallado la carga/)).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(router.replace).toHaveBeenCalledWith('/discover');
  });

  it('quien administra ve a los miembros, abre sus perfiles y puede expulsar', async () => {
    await adminWithMember();
    await renderRoute(<GroupInfoRoute />);

    await waitFor(() => expect(screen.getByText('Inés Aranda')).toBeTruthy());
    expect(screen.getByText('2 de 6 miembros')).toBeTruthy();
    expect(screen.getByText('Desarrollo · 1 de 2 libres')).toBeTruthy();
    expect(screen.getByText('Admin')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Ver el perfil de Inés Aranda' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/person/[id]',
      params: { id: 'seed-ines' },
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Expulsar a Inés Aranda' }));
    expect(screen.getByText('¿Expulsar a Inés Aranda?')).toBeTruthy();
    // Cancelar no expulsa.
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Expulsar a Inés Aranda' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar expulsión' }));

    await waitFor(() => expect(screen.getByText('1 de 6 miembros')).toBeTruthy());
    expect(screen.queryByText('Inés Aranda')).toBeNull();
    expect(screen.getByText('Desarrollo · 2 de 2 libres')).toBeTruthy();
    expect(await as('seed-ines').groups.getMine()).toBeNull();
  });

  it('si expulsar falla, lo dice y no cierra la confirmación', async () => {
    await adminWithMember();
    jest
      .spyOn(repositories.groups, 'kick')
      .mockRejectedValueOnce(new GroupError('candidate-unavailable', 'x'));
    await renderRoute(<GroupInfoRoute />);
    await waitFor(() => expect(screen.getByText('Inés Aranda')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Expulsar a Inés Aranda' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar expulsión' }));

    await waitFor(() =>
      expect(screen.getByText('Esa persona ya no está disponible.')).toBeTruthy()
    );
    expect(screen.getByText('¿Expulsar a Inés Aranda?')).toBeTruthy();
  });

  it('si el admin sale, el grupo pasa a quien queda y se vuelve atrás', async () => {
    const groupId = await adminWithMember();
    await renderRoute(<GroupInfoRoute />);
    await waitFor(() => expect(screen.getByText('Inés Aranda')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Salir del grupo' }));
    expect(screen.getByText(/el grupo pasa a quien lleva más tiempo dentro/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar salida' }));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const inherited = await as('seed-ines').groups.getMine();
    expect(inherited?.group.id).toBe(groupId);
    expect(inherited?.isAdmin).toBe(true);
  });

  it('a quien está solo se le avisa de que el grupo se borra', async () => {
    await withProfile();
    await repositories.groups.create(INPUT);
    await renderRoute(<GroupInfoRoute />);
    await waitFor(() => expect(screen.getByText('Mi Equipo')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Salir del grupo' }));
    expect(screen.getByText(/al salir, el grupo se borra/)).toBeTruthy();
  });

  it('un miembro normal no expulsa, y al salir solo pierde su plaza', async () => {
    await withProfile();
    await repositories.groups.swipeGroup(TALLER, 'like');
    await renderRoute(<GroupInfoRoute />);
    await waitFor(() => expect(screen.getByText('Marc Oller')).toBeTruthy());

    expect(screen.queryByText('Expulsar')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Salir del grupo' }));
    expect(
      screen.getByText('Tu plaza queda libre y dejarás de ver el chat del grupo.')
    ).toBeTruthy();
  });
});

describe('/group/[groupId]', () => {
  async function inTaller() {
    await repositories.session.acceptTerms(TERMS_VERSION);
    await withProfile();
    await repositories.groups.swipeGroup(TALLER, 'like');
    setSearchParams({ groupId: TALLER });
  }

  it('sin Términos aceptados no se entra a chatear', async () => {
    await withProfile();
    await repositories.groups.swipeGroup(TALLER, 'like');
    setSearchParams({ groupId: TALLER });
    await renderRoute(<GroupChatScreen />);

    await waitFor(() =>
      expect(
        screen.getByLabelText('He leído y acepto los Términos de uso y las Normas de la comunidad')
      ).toBeTruthy()
    );
    expect(screen.queryByLabelText('Mensaje')).toBeNull();
  });

  it('quien no es del grupo ve que no está disponible', async () => {
    await repositories.session.acceptTerms(TERMS_VERSION);
    await withProfile();
    setSearchParams({ groupId: [TALLER, 'otro'] });
    await renderRoute(<GroupChatScreen />);

    await waitFor(() => expect(screen.getByText('Este chat no está disponible')).toBeTruthy());
    expect(screen.getByText('Ya no estás en este grupo.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Volver a Matches' })).toBeTruthy();
  });

  it('si falla la carga, lo cuenta como fallo', async () => {
    await repositories.session.acceptTerms(TERMS_VERSION);
    await withProfile();
    jest.spyOn(repositories.groups, 'getMine').mockRejectedValue(new Error('sin red'));
    await renderRoute(<GroupChatScreen />);

    await waitFor(() => expect(screen.getByText(/Ha fallado la carga/)).toBeTruthy());
  });

  it('enseña el hilo con el nombre de quien escribe y deja enviar', async () => {
    await inTaller();
    await as('seed-marc').groups.sendMessage(TALLER, 'Bienvenida al taller');
    await as('seed-marc').groups.sendMessage(TALLER, '¿Cuándo empezamos?');
    await renderRoute(<GroupChatScreen />);

    await waitFor(() => expect(screen.getByText('Bienvenida al taller')).toBeTruthy());
    expect(screen.getByText('Chat de grupo · 3 miembros')).toBeTruthy();
    // El nombre solo encabeza el bloque: dos mensajes seguidos, un nombre.
    expect(screen.getAllByText('Marc Oller')).toHaveLength(1);

    await fireEvent.changeText(screen.getByLabelText('Mensaje'), 'Hola a todos');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar mensaje' }));

    await waitFor(() => expect(screen.getByText('Hola a todos')).toBeTruthy());
    expect(screen.getByLabelText('Mensaje').props.value).toBe('');
    expect((await as('seed-marc').groups.listMessages(TALLER)).at(-1)?.body).toBe('Hola a todos');
  });

  it('un mensaje nuevo de otra persona aparece sin recargar', async () => {
    await inTaller();
    await renderRoute(<GroupChatScreen />);
    await waitFor(() => expect(screen.getByLabelText('Mensaje')).toBeTruthy());

    await as('seed-alba').groups.sendMessage(TALLER, 'Llego tarde');

    await waitFor(() => expect(screen.getByText('Llego tarde')).toBeTruthy());
    expect(screen.getByText('Alba Ferrer')).toBeTruthy();
  });

  it('el filtro de contenido frena el envío, y un fallo de red se avisa', async () => {
    await inTaller();
    const send = jest.spyOn(repositories.groups, 'sendMessage');
    await renderRoute(<GroupChatScreen />);
    await waitFor(() => expect(screen.getByLabelText('Mensaje')).toBeTruthy());

    await fireEvent.changeText(screen.getByLabelText('Mensaje'), 'te voy a matar');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Mensaje').props.value).toBe('te voy a matar');

    send.mockRejectedValueOnce('sin red');
    await fireEvent.changeText(screen.getByLabelText('Mensaje'), 'hola');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar mensaje' }));
    await waitFor(() =>
      expect(screen.getByText('No se ha podido enviar. Inténtalo otra vez.')).toBeTruthy()
    );
  });

  it('un mensaje ajeno se puede reportar; el reporte es privado', async () => {
    await inTaller();
    const message = await as('seed-marc').groups.sendMessage(TALLER, 'mensaje raro');
    const report = jest.spyOn(repositories.groups, 'reportMessage');
    await renderRoute(<GroupChatScreen />);
    await waitFor(() => expect(screen.getByText('mensaje raro')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Reportar mensaje' }));
    // Cancelar vuelve al hilo.
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar reporte' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Reportar mensaje' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Acoso' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar reporte' }));

    await waitFor(() => expect(screen.getByText('Reporte enviado.')).toBeTruthy());
    expect(report).toHaveBeenCalledWith({ messageId: message.id, reason: 'acoso', details: '' });
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.getByText('mensaje raro')).toBeTruthy();
  });

  it('el mensaje de quien ya salió del grupo se queda, sin su nombre', async () => {
    await inTaller();
    await as('seed-alba').groups.sendMessage(TALLER, 'me voy');
    await as('seed-alba').groups.leave();
    await renderRoute(<GroupChatScreen />);

    await waitFor(() => expect(screen.getByText('me voy')).toBeTruthy());
    expect(screen.getByText('Ya no está en el grupo')).toBeTruthy();
  });
});
