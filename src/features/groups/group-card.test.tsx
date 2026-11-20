/**
 * La tarjeta de grupo: empieza en «Proyecto» con las fotos de todos, y las
 * pestañas de arriba (admin primero) cambian a la ficha de cada persona.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { buildProfile } from '@/data/test-fixtures';

import { GroupCard, membersAdminFirst } from './group-card';

import type { GroupDeckCard, GroupMemberView } from '@/data';

function member(
  id: string,
  name: string,
  specialty: GroupMemberView['specialty'],
  isAdmin = false
): GroupMemberView {
  return {
    member: { groupId: 'g1', userId: id, roleId: isAdmin ? null : `r-${id}`, joinedAt: '' },
    specialty,
    isAdmin,
    profile: buildProfile({ id, name }),
  };
}

const CARD: GroupDeckCard = {
  group: {
    id: 'g1',
    name: 'Fábrica',
    description: 'Una app para talleres',
    adminId: 'ana',
    maxMembers: 6,
    createdAt: '',
    project: null,
  },
  roles: [{ id: 'r-dev', groupId: 'g1', specialty: 'dev', slots: 1, filled: 0 }],
  // El admin llega segundo a propósito: la tarjeta tiene que empezar por él igual.
  members: [member('leo', 'Leo', 'marketing'), member('ana', 'Ana', null, true)],
  myRole: { id: 'r-dev', groupId: 'g1', specialty: 'dev', slots: 1, filled: 0 },
};

it('pone a quien administra delante', () => {
  expect(membersAdminFirst(CARD.members).map((m) => m.member.userId)).toEqual(['ana', 'leo']);
});

it('empieza en el proyecto, con la foto de cada integrante', async () => {
  await render(<GroupCard card={CARD} />);
  expect(screen.getByText('Una app para talleres')).toBeTruthy();
  expect(screen.getAllByTestId('group-member-photo', { includeHiddenElements: true })).toHaveLength(
    2
  );
});

it('ordena las pestañas: Proyecto, admin y el resto', async () => {
  await render(<GroupCard card={CARD} />);
  const names = screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel);
  expect(names[0]).toBe('Ver el proyecto del grupo');
  expect(names[1]).toMatch(/Ana/);
  expect(names[2]).toMatch(/Leo/);
});

it('usa la portada autenticada y el texto del proyecto en la primera página y las fotos personales en las demás', async () => {
  const cover = {
    uri: 'https://example.test/atlas.jpg',
    headers: { Authorization: 'Bearer test' },
  };
  const project = {
    id: 'p',
    revision: 'r',
    ownerId: 'ana',
    name: 'Atlas',
    tagline: 'Moverse mejor',
    description: 'Un mapa de rutas accesibles',
    photos: [],
    link: '',
    cover,
  };
  await render(<GroupCard card={{ ...CARD, group: { ...CARD.group, project } }} />);
  const hidden = { includeHiddenElements: true };
  const image = screen.getByTestId('group-project-cover', hidden);
  expect(image.props.source[0]).toMatchObject(cover);
  expect(screen.queryByTestId('group-member-photo', hidden)).toBeNull();
  expect(screen.getByText('Atlas')).toBeTruthy();
  expect(screen.getByText(project.description)).toBeTruthy();
  expect(screen.getByText('Perfiles que buscamos')).toBeTruthy();
  await fireEvent.press(screen.getByRole('tab', { name: /Ana/ }));
  expect(screen.getByText('Ana')).toBeTruthy();
  expect(screen.queryByTestId('group-project-cover', hidden)).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: 'Ver el proyecto del grupo' }));
  expect(screen.getByText('Atlas')).toBeTruthy();
});

it('cambia de persona con las pestañas', async () => {
  await render(<GroupCard card={CARD} />);
  await fireEvent.press(screen.getByRole('tab', { name: /Ana/ }));
  expect(screen.getByText('Ana')).toBeTruthy();
  expect(screen.queryByText('Leo')).toBeNull();

  await fireEvent.press(screen.getByRole('tab', { name: /Leo/ }));
  expect(screen.getByText('Leo')).toBeTruthy();
  expect(screen.queryByText('Ana')).toBeNull();

  await fireEvent.press(screen.getByRole('tab', { name: 'Ver el proyecto del grupo' }));
  expect(screen.getByText('Una app para talleres')).toBeTruthy();
});
