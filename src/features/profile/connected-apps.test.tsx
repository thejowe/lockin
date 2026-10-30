/**
 * Tests del `@usuario` de Instagram y TikTok en «Redes y enlaces».
 *
 * Lo que no puede fallar: que se saque el usuario de los enlaces de perfil
 * normales, que una publicación suelta no se lea como usuario, y que la
 * píldora con `@usuario` siga siendo un enlace a la URL tal cual.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking, View } from 'react-native';

import { buildProfile } from '@/data/test-fixtures';

import { ConnectedApps, socialHandle } from './connected-apps';

describe('socialHandle', () => {
  it.each([
    ['https://instagram.com/ana.bosch', 'ana.bosch'],
    ['https://www.instagram.com/ana_bosch/', 'ana_bosch'],
    ['https://www.instagram.com/ana.bosch?igsh=abc', 'ana.bosch'],
  ])('Instagram %s → %s', (url, handle) => {
    expect(socialHandle('instagram', url)).toBe(handle);
  });

  it.each([
    'https://www.instagram.com/p/C1abc/',
    'https://www.instagram.com/reel/C1abc/',
    'https://instagram.com/',
    'https://example.com/ana',
  ])('Instagram sin usuario: %s', (url) => {
    expect(socialHandle('instagram', url)).toBeNull();
  });

  it('TikTok saca el usuario de /@usuario y no de un enlace acortado', () => {
    expect(socialHandle('tiktok', 'https://www.tiktok.com/@ana.bosch')).toBe('ana.bosch');
    expect(socialHandle('tiktok', 'https://www.tiktok.com/@ana/video/123')).toBe('ana');
    expect(socialHandle('tiktok', 'https://vm.tiktok.com/ZMabc/')).toBeNull();
  });

  it('los demás no llevan @', () => {
    expect(socialHandle('github', 'https://github.com/ana')).toBeNull();
  });
});

describe('ConnectedApps', () => {
  it('Instagram sale con @usuario y abre la URL del perfil', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const profile = buildProfile({
      name: 'Ana',
      links: { instagram: 'https://instagram.com/ana.bosch' },
    });
    await render(<ConnectedApps profile={profile} />);

    expect(screen.getByText('@ana.bosch')).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('link', { name: 'Abrir el Instagram de Ana, @ana.bosch' })
    );
    expect(openURL).toHaveBeenCalledWith('https://instagram.com/ana.bosch');
    openURL.mockRestore();
  });

  it('sin enlaces y sin acción no pinta nada; con acción, invita a añadirlos', async () => {
    const profile = buildProfile({ links: {} });
    await render(<ConnectedApps profile={profile} />);
    expect(screen.queryByText('Redes y enlaces')).toBeNull();

    await render(<ConnectedApps profile={profile} action={<View testID="lapiz" />} />);
    expect(screen.getByText('Redes y enlaces')).toBeTruthy();
    expect(screen.getByTestId('lapiz')).toBeTruthy();
    expect(screen.getByText(/Añade tu Instagram/)).toBeTruthy();
  });
});
