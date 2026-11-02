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
    // Enlaces de «compartir perfil» reales (2026-10-30).
    [
      'https://www.instagram.com/godblessjowe?cplk=MTl6OW5jMXBwcHFwdw%3D%3D&utm_source=qr',
      'godblessjowe',
    ],
    ['https://www.instagram.com/rogergiral?dlrf=b3VmaGlxcTZreXIz&utm_source=qr', 'rogergiral'],
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

  it('no depende del `URL` del motor, que en el móvil no siempre está completo', () => {
    const original = global.URL;
    // @ts-expect-error: se quita a propósito para simular el motor del móvil.
    global.URL = undefined;
    try {
      expect(socialHandle('instagram', 'https://www.instagram.com/ana?igsh=x')).toBe('ana');
    } finally {
      global.URL = original;
    }
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

  it('perfil propio: los cinco logos, y tocar uno despliega su campo y guarda', async () => {
    const onSaveLink = jest.fn().mockResolvedValue(undefined);
    const profile = buildProfile({ links: { github: 'https://github.com/ana' } });
    await render(<ConnectedApps profile={profile} onSaveLink={onSaveLink} />);

    for (const name of ['GitHub', 'LinkedIn', 'Instagram', 'TikTok', 'Web']) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: 'Añadir Instagram' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Añadir Instagram' }));
    await fireEvent.changeText(
      screen.getByLabelText('Enlace de Instagram'),
      'https://instagram.com/ana'
    );
    await fireEvent.press(screen.getByText('Guardar'));
    expect(onSaveLink).toHaveBeenCalledWith('instagram', 'https://instagram.com/ana');
  });

  it('perfil propio: un enlace sin http no se guarda', async () => {
    const onSaveLink = jest.fn().mockResolvedValue(undefined);
    await render(<ConnectedApps profile={buildProfile({ links: {} })} onSaveLink={onSaveLink} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Añadir TikTok' }));
    await fireEvent.changeText(screen.getByLabelText('Enlace de TikTok'), 'tiktok.com/@ana');
    await fireEvent.press(screen.getByText('Guardar'));
    expect(onSaveLink).not.toHaveBeenCalled();
    expect(screen.getByText(/empezar por http/)).toBeTruthy();
  });

  it('perfil propio: un enlace con insultos no se guarda', async () => {
    const onSaveLink = jest.fn().mockResolvedValue(undefined);
    await render(<ConnectedApps profile={buildProfile({ links: {} })} onSaveLink={onSaveLink} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Añadir TikTok' }));
    await fireEvent.changeText(
      screen.getByLabelText('Enlace de TikTok'),
      'https://tiktok.com/@idiota'
    );
    await fireEvent.press(screen.getByText('Guardar'));
    expect(onSaveLink).not.toHaveBeenCalled();
    expect(screen.getByText(/lenguaje que no permitimos/)).toBeTruthy();
  });
});
