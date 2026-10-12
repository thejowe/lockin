/**
 * El avatar de las listas y del chat: foto si la hay, color con iniciales si no.
 *
 * Ojo: en RNTL 14 `render` es asíncrono.
 */

import { render, screen } from '@testing-library/react-native';

import { ProfileAvatar } from './profile-avatar';

describe('ProfileAvatar (chat)', () => {
  it('con imageUrl pinta la foto y no las iniciales', async () => {
    await render(
      <ProfileAvatar avatar={{ initials: 'NB', accent: 'teal', imageUrl: 'https://x/a.jpg' }} />
    );

    expect(screen.getByTestId('avatar-photo')).toBeTruthy();
    expect(screen.queryByText('NB')).toBeNull();
  });

  it('sin imageUrl pinta las iniciales como siempre', async () => {
    await render(<ProfileAvatar avatar={{ initials: 'NB', accent: 'teal' }} size={64} />);

    expect(screen.getByText('NB')).toBeTruthy();
    expect(screen.queryByTestId('avatar-photo')).toBeNull();
  });
});
