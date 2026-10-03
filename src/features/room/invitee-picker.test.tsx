import { fireEvent, render, screen } from '@testing-library/react-native';

import { buildProfile } from '@/data/test-fixtures';

import { InviteePicker } from './invitee-picker';

import type { MatchWithProfile } from '@/data';

const NAMES = ['Ana García', 'Bea Puig', 'Carla Soler', 'Dani Roca', 'Eva Mas'];

const matches: MatchWithProfile[] = NAMES.map((name, index) => ({
  id: `match-${index}`,
  profileIds: ['me', `p-${index}`],
  mode: 'lockin',
  createdAt: '2026-10-01T10:00:00.000Z',
  lastMessageAt: null,
  counterpart: buildProfile({ id: `p-${index}`, name }),
  lastMessage: null,
}));

function chip(name: string) {
  return screen.getByRole('checkbox', { name });
}

it('pinta un chip de selección por match, con su estado marcado', async () => {
  await render(
    <InviteePicker matches={matches} selected={new Set(['p-1'])} onToggle={jest.fn()} />
  );

  expect(screen.getAllByRole('checkbox')).toHaveLength(5);
  expect(chip('Bea Puig').props.accessibilityState).toMatchObject({ checked: true });
  expect(chip('Ana García').props.accessibilityState).toMatchObject({ checked: false });
  expect(screen.getByText('1 de 4')).toBeTruthy();
});

it('avisa de quién se toca', async () => {
  const onToggle = jest.fn();
  await render(<InviteePicker matches={matches} selected={new Set()} onToggle={onToggle} />);

  await fireEvent.press(chip('Carla Soler'));

  expect(onToggle).toHaveBeenCalledWith('p-2');
  expect(screen.getByText('0 de 4')).toBeTruthy();
});

it('con 4 marcados deshabilita los demás, y desmarcar uno los vuelve a habilitar', async () => {
  const onToggle = jest.fn();
  const { rerender } = await render(
    <InviteePicker
      matches={matches}
      selected={new Set(['p-0', 'p-1', 'p-2', 'p-3'])}
      onToggle={onToggle}
    />
  );

  expect(screen.getByText('4 de 4')).toBeTruthy();
  expect(chip('Eva Mas').props.accessibilityState).toMatchObject({ disabled: true });
  expect(chip('Ana García').props.accessibilityState).toMatchObject({ disabled: false });
  await fireEvent.press(chip('Eva Mas'));
  expect(onToggle).not.toHaveBeenCalled();

  await rerender(
    <InviteePicker
      matches={matches}
      selected={new Set(['p-0', 'p-1', 'p-2'])}
      onToggle={onToggle}
    />
  );

  expect(chip('Eva Mas').props.accessibilityState).toMatchObject({ disabled: false });
  await fireEvent.press(chip('Eva Mas'));
  expect(onToggle).toHaveBeenCalledWith('p-4');
});
