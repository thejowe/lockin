/**
 * Tests del bloque «Foto» del perfil propio.
 *
 * El selector nativo se sustituye por un doble: lo que se prueba es qué pasa en
 * cada desenlace —subida, permiso denegado, cancelado, rechazo del servidor— y
 * que cada uno deje el perfil y el aviso como toca.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DataProvider } from '@/data';
import { createMockRepositories, resetState } from '@/data/mock';
import { buildProfileInput } from '@/data/test-fixtures';

import { pickAvatarPhoto } from './avatar-photo';
import { PhotoSection } from './photo-section';

import type { Profile, Repositories } from '@/data';

jest.mock('./avatar-photo', () => ({ pickAvatarPhoto: jest.fn() }));
const pick = pickAvatarPhoto as jest.Mock;

let repositories: Repositories;
let profile: Profile;
const onChange = jest.fn();

async function setup(withPhoto = false) {
  resetState();
  repositories = createMockRepositories();
  profile = await repositories.profiles.saveCurrent(buildProfileInput());
  if (withPhoto) profile = await repositories.profiles.setAvatarPhoto('file:///vieja.jpg');
  onChange.mockClear();
  pick.mockReset();

  await render(
    <DataProvider value={repositories}>
      <PhotoSection profile={profile} onChange={onChange} />
    </DataProvider>
  );
}

describe('PhotoSection', () => {
  it('sin foto lo dice y no ofrece quitarla', async () => {
    await setup();

    expect(screen.getByText('Aún no tienes foto')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Quitar foto' })).toBeNull();
  });

  it('elegir de la galería sube la foto y avisa con onChange', async () => {
    await setup();
    pick.mockResolvedValue({ status: 'picked', uri: 'file:///nueva.jpg' });

    await fireEvent.press(screen.getByRole('button', { name: 'Elegir de la galería' }));

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(pick).toHaveBeenCalledWith('library');
    expect((await repositories.profiles.getCurrent())?.avatar.imageUrl).toBe('file:///nueva.jpg');
  });

  it('hacer una foto usa la cámara', async () => {
    await setup();
    pick.mockResolvedValue({ status: 'picked', uri: 'file:///camara.jpg' });

    await fireEvent.press(screen.getByRole('button', { name: 'Hacer una foto' }));

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(pick).toHaveBeenCalledWith('camera');
  });

  it('permiso denegado enseña el mensaje y no sube nada', async () => {
    await setup();
    pick.mockResolvedValue({ status: 'denied' });

    await fireEvent.press(screen.getByRole('button', { name: 'Hacer una foto' }));

    expect(await screen.findByText(/Sin permiso de cámara/)).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    expect((await repositories.profiles.getCurrent())?.avatar.imageUrl).toBeUndefined();
  });

  it('cancelar no cambia nada ni enseña error', async () => {
    await setup();
    pick.mockResolvedValue({ status: 'cancelled' });

    await fireEvent.press(screen.getByRole('button', { name: 'Elegir de la galería' }));

    await waitFor(() => expect(pick).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('si el servidor rechaza la foto enseña el motivo y deja reintentar', async () => {
    await setup();
    pick.mockResolvedValue({ status: 'picked', uri: 'file:///nueva.jpg' });
    jest
      .spyOn(repositories.profiles, 'setAvatarPhoto')
      .mockRejectedValueOnce(
        new Error('Esta foto no cumple las normas de la comunidad. Prueba con otra.')
      );

    await fireEvent.press(screen.getByRole('button', { name: 'Elegir de la galería' }));

    expect(
      await screen.findByText('Esta foto no cumple las normas de la comunidad. Prueba con otra.')
    ).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Elegir de la galería' })).not.toBeDisabled();
  });

  it('con foto, «Quitar foto» llama a removeAvatarPhoto y avisa', async () => {
    await setup(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Quitar foto' }));

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect((await repositories.profiles.getCurrent())?.avatar.imageUrl).toBeUndefined();
  });
});
