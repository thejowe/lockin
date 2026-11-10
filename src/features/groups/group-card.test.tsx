/**
 * La tarjeta de grupo: empieza en la ficha de quien administra, cambia de
 * persona con las pestañas de arriba y «Proyecto» enseña el grupo.
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
  },
  roles: [{ id: 'r-dev', groupId: 'g1', specialty: 'dev', slots: 1, filled: 0 }],
  // El admin llega segundo a propósito: la tarjeta tiene que empezar por él igual.
  members: [member('leo', 'Leo', 'marketing'), member('ana', 'Ana', null, true)],
  myRole: { id: 'r-dev', groupId: 'g1', specialty: 'dev', slots: 1, filled: 0 },
};

it('pone a quien administra delante', () => {
  expect(membersAdminFirst(CARD.members).map((m) => m.member.userId)).toEqual(['ana', 'leo']);
});

it('empieza en el admin y cambia de persona con las pestañas', async () => {
  await render(<GroupCard card={CARD} />);
  expect(screen.getByText('Ana')).toBeTruthy();
  expect(screen.queryByText('Leo')).toBeNull();

  await fireEvent.press(screen.getByRole('tab', { name: /Leo/ }));
  expect(screen.getByText('Leo')).toBeTruthy();
  expect(screen.queryByText('Ana')).toBeNull();

  await fireEvent.press(screen.getByRole('tab', { name: 'Ver el proyecto del grupo' }));
  expect(screen.getByText('Una app para talleres')).toBeTruthy();
});
