/**
 * Las secciones de grupos de Descubrir, de punta a punta sobre el backend mock:
 * qué ve quien busca grupo, quien administra uno (también busca otros, y recluta
 * en la pestaña con el nombre de su grupo) y quien ya es miembro; la unión por
 * like recíproco; el tope de 3 grupos; bloquear y reportar un grupo; y cómo se
 * enganchan en Descubrir (el selector) y en Matches (una fila por grupo).
 *
 * El mock nace con dos grupos semilla; «Taller Abierto» ya le ha dado like a la
 * cuenta propia para su puesto de desarrollo.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { GroupError } from '@/data';
import { createMockRepositories, defaultMockStore } from '@/data/mock';
import { buildProfileInput } from '@/data/test-fixtures';
import { GroupsSection } from '@/features/groups';

import { renderRoute, repositories, resetRepositories, resetRouter, router } from '../routes';

import DiscoverScreen from '../../src/app/(tabs)/discover';
import MatchesScreen from '../../src/app/(tabs)/matches';

import type { GroupInput, Specialty } from '@/data';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

const INPUT: GroupInput = {
  name: 'Mi Equipo',
  description: 'Un proyecto de prueba con descripción.',
  roles: [{ specialty: 'dev', slots: 1 }],
};

const as = (actorId: string) => createMockRepositories(defaultMockStore, { actorId });

async function withProfile(specialties: Specialty[] = ['dev']) {
  await repositories.profiles.saveCurrent(buildProfileInput({ name: 'Yo Misma', specialties }));
}

async function renderSection(
  onDeckActive?: (active: boolean) => void,
  section: 'groups' | 'my-group' = 'groups'
) {
  const view = await renderRoute(
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GroupsSection section={section} onDeckActive={onDeckActive} />
    </GestureHandlerRootView>
  );
  await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
  return view;
}

/** El nombre de un grupo sale más de una vez en su tarjeta: basta con el primero. */
const groupName = (name: string) => screen.getAllByText(name)[0];

/** `seed-alba` y `seed-ines` crean un grupo con un puesto de desarrollo y meten a la cuenta propia. */
async function joinSeedGroups(admins: string[]) {
  for (const admin of admins) {
    const view = await as(admin).groups.create({ ...INPUT, name: `De ${admin}` });
    await as(admin).groups.swipeCandidate('me', view.roles[0].id, 'like');
    expect((await as('me').groups.swipeGroup(view.group.id, 'like')).joined).toBe(true);
  }
}

beforeEach(() => {
  resetRepositories();
  resetRouter();
});

describe('quien busca grupo', () => {
  it('ve el grupo, su puesto, los cargos de dentro y los puestos', async () => {
    await withProfile();
    const onDeckActive = jest.fn();
    await renderSection(onDeckActive);

    expect(groupName('Taller Abierto')).toBeTruthy();
    expect(screen.getByText('2 de 6 miembros')).toBeTruthy();
    expect(screen.getByText('Encajas como')).toBeTruthy();
    expect(screen.getByText('✓ Desarrollo')).toBeTruthy();
    expect(screen.getByText('Desarrollo · 2 de 2 libres')).toBeTruthy();
    expect(screen.getByText('Marketing · completo')).toBeTruthy();
    expect(onDeckActive).toHaveBeenLastCalledWith(true);

    // Cada pestaña de arriba es una persona: enseña su ficha, y desde ella su perfil.
    expect(screen.getByRole('tab', { name: 'Marketing: ver a Alba Ferrer' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Admin: ver a Marc Oller' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Ver el perfil de Marc Oller' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/person/[id]',
      params: { id: 'seed-marc' },
    });
  });

  it('con like recíproco entra en el grupo y sigue viendo otros grupos', async () => {
    await withProfile();
    await renderSection();

    await fireEvent.press(screen.getByRole('button', { name: 'Quiero entrar' }));

    await waitFor(() =>
      expect(
        screen.getByText('¡Estás dentro de Taller Abierto! Tienes su chat en Matches.')
      ).toBeTruthy()
    );
    // Puede estar en varios grupos: el deck sigue con el siguiente.
    expect(groupName('Ruta Verde')).toBeTruthy();
    expect((await repositories.groups.listMine()).map((view) => view.group.id)).toEqual([
      'seed-group-taller',
    ]);
  });

  it('un pase lleva al siguiente grupo', async () => {
    await withProfile();
    await renderSection();

    await fireEvent.press(screen.getByRole('button', { name: 'Pasar' }));

    await waitFor(() => expect(screen.queryByText('Taller Abierto')).toBeNull());
    expect(groupName('Ruta Verde')).toBeTruthy();
  });

  it('sin grupos que encajen ofrece crear uno y volver a comprobar', async () => {
    await withProfile(['legal']);
    const getDeck = jest.spyOn(repositories.groups, 'getDeck');
    const onDeckActive = jest.fn();
    await renderSection(onDeckActive);

    expect(screen.getByText('Ningún grupo busca ahora lo que dominas')).toBeTruthy();
    expect(onDeckActive).toHaveBeenLastCalledWith(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Crear grupo' }));
    expect(router.push).toHaveBeenCalledWith('/group/new');

    await fireEvent.press(screen.getByRole('button', { name: 'Volver a comprobar' }));
    await waitFor(() => expect(getDeck).toHaveBeenCalledTimes(2));
  });

  it('con cartas también se puede crear un grupo', async () => {
    await withProfile();
    await renderSection();
    await fireEvent.press(screen.getByRole('button', { name: 'Crear grupo' }));
    expect(router.push).toHaveBeenCalledWith('/group/new');
  });

  it('si el deck no carga, lo dice y deja reintentar', async () => {
    await withProfile();
    const getDeck = jest
      .spyOn(repositories.groups, 'getDeck')
      .mockRejectedValueOnce(new Error('sin red'));
    await renderSection();

    expect(screen.getByText('No hemos podido cargar los grupos')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(groupName('Taller Abierto')).toBeTruthy());
    expect(getDeck).toHaveBeenCalledTimes(2);
  });

  it('si la decisión no se guarda, la carta vuelve y se avisa', async () => {
    await withProfile();
    jest.spyOn(repositories.groups, 'swipeGroup').mockRejectedValueOnce(new Error('sin red'));
    await renderSection();

    await fireEvent.press(screen.getByRole('button', { name: 'Pasar' }));

    await waitFor(() => expect(screen.getByText(/No hemos podido guardar/)).toBeTruthy());
    expect(groupName('Taller Abierto')).toBeTruthy();
  });

  it('un grupo que ya no existe se retira sin aviso', async () => {
    await withProfile();
    jest
      .spyOn(repositories.groups, 'swipeGroup')
      .mockRejectedValueOnce(new GroupError('unavailable', 'ya no está'));
    await renderSection();

    await fireEvent.press(screen.getByRole('button', { name: 'Quiero entrar' }));

    await waitFor(() => expect(groupName('Ruta Verde')).toBeTruthy());
    expect(screen.queryByText(/No hemos podido guardar/)).toBeNull();
  });

  it('si llega al tope de grupos por otro lado, se relee y lo explica', async () => {
    await withProfile();
    await renderSection();
    // Entra en 3 grupos desde otro dispositivo mientras mira el deck.
    await as('me').groups.swipeGroup('seed-group-taller', 'like');
    await joinSeedGroups(['seed-alba', 'seed-ines']);

    await fireEvent.press(screen.getByRole('button', { name: 'Pasar' }));

    await waitFor(() => expect(screen.getByText('Ya estás en 3 grupos')).toBeTruthy());
  });

  it('en el tope de grupos no hay deck y se explica por qué', async () => {
    await withProfile();
    await as('me').groups.swipeGroup('seed-group-taller', 'like');
    await joinSeedGroups(['seed-alba', 'seed-ines']);
    const onDeckActive = jest.fn();
    await renderSection(onDeckActive);

    expect(screen.getByText('Ya estás en 3 grupos')).toBeTruthy();
    expect(screen.queryByText('Taller Abierto')).toBeNull();
    expect(onDeckActive).not.toHaveBeenCalledWith(true);
  });

  it('quien ya es miembro sigue buscando grupo, sin ver el suyo', async () => {
    await withProfile();
    await repositories.groups.swipeGroup('seed-group-taller', 'like');
    await renderSection();

    expect(groupName('Ruta Verde')).toBeTruthy();
    expect(screen.queryByText('Taller Abierto')).toBeNull();
    // No administra ninguno: puede crear el suyo.
    expect(screen.getByRole('button', { name: 'Crear grupo' })).toBeTruthy();
  });
});

describe('bloquear y reportar un grupo', () => {
  async function openMenu() {
    await withProfile();
    await renderSection();
    await fireEvent.press(screen.getByRole('button', { name: 'Opciones de Taller Abierto' }));
  }

  it('el menú se abre sobre la tarjeta y se cierra sin hacer nada', async () => {
    await openMenu();
    // Con el panel abierto no hay botones de decidir.
    expect(screen.queryByRole('button', { name: 'Quiero entrar' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar opciones' }));
    expect(screen.getByRole('button', { name: 'Quiero entrar' })).toBeTruthy();
  });

  it('bloquear pide confirmación, saca el grupo del deck y bloquea a su admin', async () => {
    await openMenu();
    await fireEvent.press(screen.getByRole('button', { name: 'Bloquear el grupo Taller Abierto' }));
    expect(screen.getByText('¿Bloquear el grupo Taller Abierto?')).toBeTruthy();

    // Cancelar vuelve al menú.
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar bloqueo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Bloquear el grupo Taller Abierto' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar bloqueo' }));

    await waitFor(() => expect(screen.queryByText('Taller Abierto')).toBeNull());
    expect(groupName('Ruta Verde')).toBeTruthy();
    expect(await repositories.profiles.getById('seed-marc')).toBeNull();
  });

  it('si bloquear falla, lo dice y deja reintentar', async () => {
    jest.spyOn(repositories.groups, 'block').mockRejectedValueOnce(new Error('sin red'));
    await openMenu();
    await fireEvent.press(screen.getByRole('button', { name: 'Bloquear el grupo Taller Abierto' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar bloqueo' }));

    await waitFor(() =>
      expect(screen.getByText('No se ha podido bloquear. Inténtalo otra vez.')).toBeTruthy()
    );
  });

  it('reportar envía el motivo al sistema de reportes de siempre', async () => {
    const report = jest.spyOn(repositories.groups, 'report');
    await openMenu();
    await fireEvent.press(screen.getByRole('button', { name: 'Reportar el grupo Taller Abierto' }));
    expect(screen.getByText('Reportar el grupo Taller Abierto')).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'Spam o estafa' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar reporte' }));

    await waitFor(() => expect(screen.getByText('Reporte enviado.')).toBeTruthy());
    expect(report).toHaveBeenCalledWith({
      groupId: 'seed-group-taller',
      reason: 'spam',
      details: '',
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar opciones' }));
    expect(groupName('Taller Abierto')).toBeTruthy();
  });

  it('del formulario de reporte se vuelve al menú', async () => {
    await openMenu();
    await fireEvent.press(screen.getByRole('button', { name: 'Reportar el grupo Taller Abierto' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar reporte' }));
    expect(screen.getByRole('button', { name: 'Bloquear el grupo Taller Abierto' })).toBeTruthy();
  });
});

describe('quien administra un grupo', () => {
  async function asAdmin(input: GroupInput = INPUT) {
    await withProfile(['producto']);
    return repositories.groups.create(input);
  }

  it('ve el deck de reclutamiento, con el puesto que cubriría cada persona', async () => {
    const { group } = await asAdmin();
    const onDeckActive = jest.fn();
    await renderSection(onDeckActive, 'my-group');

    expect(screen.getByText('Buscando gente para Mi Equipo')).toBeTruthy();
    expect(
      screen.getAllByText('Cubriría: Desarrollo', { includeHiddenElements: true }).length
    ).toBe(2);
    expect(onDeckActive).toHaveBeenLastCalledWith(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Tu grupo' }));
    expect(router.push).toHaveBeenCalledWith(`/group/info?id=${group.id}`);
  });

  it('al darle like a quien ya quería entrar, entra y el deck se relee', async () => {
    const { group } = await asAdmin();
    await as('seed-ines').groups.swipeGroup(group.id, 'like');
    await renderSection(undefined, 'my-group');

    await fireEvent.press(
      screen.getByRole('button', { name: 'Quiero a esta persona en el grupo' })
    );

    await waitFor(() =>
      expect(screen.getByText('Inés Aranda ha entrado en el grupo')).toBeTruthy()
    );
    // Con la única plaza cubierta no queda nadie por reclutar.
    await waitFor(() => expect(screen.getByText('Tu grupo está completo')).toBeTruthy());
    expect((await repositories.groups.listMine())[0]?.members).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Abrir el chat del grupo' })).toBeTruthy();
  });

  it('un pase pasa a la siguiente persona, sin unir a nadie', async () => {
    await asAdmin();
    const swipe = jest.spyOn(repositories.groups, 'swipeCandidate');
    await renderSection(undefined, 'my-group');

    await fireEvent.press(screen.getByRole('button', { name: 'Pasar' }));

    await waitFor(() =>
      expect(swipe).toHaveBeenCalledWith('seed-ines', expect.any(String), 'pass')
    );
    expect(screen.queryByText(/ha entrado en el grupo/)).toBeNull();
  });

  it('sin candidatos pero con plazas, dice que no queda nadie', async () => {
    await asAdmin({ ...INPUT, roles: [{ specialty: 'hardware', slots: 1 }] });
    const getRecruitDeck = jest.spyOn(repositories.groups, 'getRecruitDeck');
    await renderSection(undefined, 'my-group');

    expect(screen.getByText('No queda nadie por ver')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Volver a comprobar' }));
    await waitFor(() => expect(getRecruitDeck).toHaveBeenCalledTimes(2));
  });

  it('si el deck no carga o la decisión no se guarda, lo dice', async () => {
    await asAdmin();
    jest.spyOn(repositories.groups, 'getRecruitDeck').mockRejectedValueOnce(new Error('sin red'));
    jest.spyOn(repositories.groups, 'swipeCandidate').mockRejectedValueOnce(new Error('sin red'));
    await renderSection(undefined, 'my-group');

    expect(screen.getByText('No hemos podido cargar el deck')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Quiero a esta persona en el grupo' })).toBeTruthy()
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Pasar' }));
    await waitFor(() => expect(screen.getByText(/No hemos podido guardar/)).toBeTruthy());
  });

  it('el perfil completo de la persona se abre desde su tarjeta', async () => {
    await asAdmin();
    await renderSection(undefined, 'my-group');
    await fireEvent.press(screen.getByRole('button', { name: 'Ver el perfil de Inés Aranda' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/person/[id]',
      params: { id: 'seed-ines' },
    });
  });

  it('en «Grupos» busca otros grupos, sin el suyo y sin poder crear otro', async () => {
    await asAdmin();
    await renderSection();

    // Domina producto: Ruta Verde lo busca.
    expect(groupName('Ruta Verde')).toBeTruthy();
    expect(screen.queryByText('Mi Equipo')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Crear grupo' })).toBeNull();
  });
});

describe('la sección entera', () => {
  it('si «mi grupo» no carga, lo dice y deja reintentar', async () => {
    await withProfile();
    jest.spyOn(repositories.groups, 'listMine').mockRejectedValueOnce(new Error('sin red'));
    await renderSection();

    expect(screen.getByText('No hemos podido cargar los grupos')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(groupName('Taller Abierto')).toBeTruthy());
  });
});

describe('Descubrir', () => {
  it('tiene dos secciones: Cofundador, como siempre, y Grupos', async () => {
    await withProfile();
    await renderRoute(
      <GestureHandlerRootView style={{ flex: 1 }}>
        <DiscoverScreen />
      </GestureHandlerRootView>
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Filtros' })).toBeTruthy());
    expect(screen.getByRole('tab', { name: 'Cofundador' }).props.accessibilityState.selected).toBe(
      true
    );

    await fireEvent.press(screen.getByRole('tab', { name: 'Grupos' }));

    await waitFor(() => expect(groupName('Taller Abierto')).toBeTruthy());
    // Los filtros son del deck de cofundador.
    expect(screen.queryByRole('button', { name: 'Filtros' })).toBeNull();

    await fireEvent.press(screen.getByRole('tab', { name: 'Cofundador' }));
    expect(screen.getByRole('button', { name: 'Filtros' })).toBeTruthy();
    expect(screen.queryByText('Taller Abierto')).toBeNull();
    // Sin grupo que administrar no hay tercera pestaña.
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('con un grupo propio, una pestaña con su nombre para reclutar', async () => {
    await withProfile(['producto']);
    await repositories.groups.create(INPUT);
    await renderRoute(
      <GestureHandlerRootView style={{ flex: 1 }}>
        <DiscoverScreen />
      </GestureHandlerRootView>
    );
    await fireEvent.press(await screen.findByRole('tab', { name: 'Grupos' }));
    const tab = await screen.findByRole('tab', { name: 'Reclutar para Mi Equipo' });
    expect(screen.getByText('Mi Equipo')).toBeTruthy();

    await fireEvent.press(tab);
    await waitFor(() => expect(screen.getByText('Buscando gente para Mi Equipo')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Filtros' })).toBeNull();

    // «Grupos» sigue siendo buscar grupo.
    await fireEvent.press(screen.getByRole('tab', { name: 'Grupos' }));
    await waitFor(() => expect(groupName('Ruta Verde')).toBeTruthy());
    expect(screen.queryByText('Buscando gente para Mi Equipo')).toBeNull();
  });
});

describe('Matches', () => {
  it('sin grupo no hay fila de chat de grupo', async () => {
    await withProfile();
    await renderRoute(<MatchesScreen />);
    await waitFor(() => expect(screen.getByText('Con quién has conectado')).toBeTruthy());
    expect(screen.queryByText(/Chat de grupo/)).toBeNull();
  });

  it('con grupo, su chat sale junto a las conversaciones', async () => {
    await withProfile();
    await repositories.groups.swipeGroup('seed-group-taller', 'like');
    await renderRoute(<MatchesScreen />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Chat del grupo Taller Abierto' })).toBeTruthy()
    );
    expect(screen.getByText('Chat de grupo · 3 miembros')).toBeTruthy();
  });

  it('con varios grupos, una fila por grupo', async () => {
    await withProfile();
    await repositories.groups.swipeGroup('seed-group-taller', 'like');
    await joinSeedGroups(['seed-alba']);
    await renderRoute(<MatchesScreen />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Chat del grupo Taller Abierto' })).toBeTruthy()
    );
    expect(screen.getByRole('button', { name: 'Chat del grupo De seed-alba' })).toBeTruthy();
  });
});
