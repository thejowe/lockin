import { render, screen } from '@testing-library/react-native';

import { UnreadBadge, unreadLabel } from './unread-badge';

it('sin nada pendiente no pinta nada', async () => {
  await render(<UnreadBadge count={0} />);
  expect(screen.queryByTestId('unread-badge', { includeHiddenElements: true })).toBeNull();
});

it('pinta el número de mensajes sin leer', async () => {
  await render(<UnreadBadge count={3} />);
  expect(screen.getByText('3', { includeHiddenElements: true })).toBeTruthy();
});

it('a partir de 100 dice 99+', () => {
  expect(unreadLabel(99)).toBe('99');
  expect(unreadLabel(100)).toBe('99+');
});
