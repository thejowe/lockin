/**
 * El avatar del perfil: foto si la hay, color con iniciales si no.
 *
 * Ojo: en RNTL 14 `render` es asíncrono.
 */

import { render, screen } from '@testing-library/react-native';

import { ProfileAvatar } from './profile-avatar';

// El avatar se oculta a los lectores de pantalla a propósito (el nombre ya va al lado).
const HIDDEN = { includeHiddenElements: true };

describe('ProfileAvatar', () => {
  it('con imageUrl pinta la foto y no las iniciales', async () => {
    await render(
      <ProfileAvatar avatar={{ initials: 'NB', accent: 'teal', imageUrl: 'https://x/a.jpg' }} />
    );

    expect(screen.getByTestId('avatar-photo', HIDDEN)).toBeTruthy();
    expect(screen.queryByText('NB', HIDDEN)).toBeNull();
  });

  it('sin imageUrl pinta las iniciales como siempre', async () => {
    await render(<ProfileAvatar avatar={{ initials: 'NB', accent: 'teal' }} />);

    expect(screen.getByText('NB', HIDDEN)).toBeTruthy();
    expect(screen.queryByTestId('avatar-photo', HIDDEN)).toBeNull();
  });
});
