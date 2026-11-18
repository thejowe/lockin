/**
 * Puerta de foto (2026-11-18): sin foto de perfil aprobada no se entra a las
 * pestañas, también en las cuentas anteriores a la foto obligatoria, y la
 * pantalla `/photo` solo deja salir con una foto que el servidor ha aprobado.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { buildProfileInput } from '@/data/test-fixtures';
import { pickAvatarPhoto } from '@/features/profile/avatar-photo';
import { PhotoGateScreen } from '@/features/profile/photo-gate-screen';
import { RequirePhoto } from '@/features/profile/require-photo';

import { renderRoute, repositories, resetRepositories, resetRouter, router } from '../routes';

jest.mock('expo-router', () => require('../routes').expoRouterMock());
jest.mock('@/features/profile/avatar-photo', () => ({ pickAvatarPhoto: jest.fn() }));
const pick = pickAvatarPhoto as jest.Mock;

beforeEach(() => {
  resetRouter();
  resetRepositories();
  pick.mockReset();
});

const Tabs = () => <Text>pestañas</Text>;

describe('RequirePhoto', () => {
  it('sin foto aprobada manda a /photo y no pinta las pestañas (cuenta antigua)', async () => {
    await repositories.profiles.saveCurrent(buildProfileInput());
    await renderRoute(
      <RequirePhoto>
        <Tabs />
      </RequirePhoto>
    );
    await waitFor(() => expect(router.redirects).toEqual(['/photo']));
    expect(screen.queryByText('pestañas')).toBeNull();
  });

  it('con foto aprobada deja pasar', async () => {
    await repositories.profiles.saveCurrent(buildProfileInput());
    await repositories.profiles.setAvatarPhoto('file:///cara.jpg');
    await renderRoute(
      <RequirePhoto>
        <Tabs />
      </RequirePhoto>
    );
    expect(await screen.findByText('pestañas')).toBeTruthy();
    expect(router.redirects).toEqual([]);
  });

  it('si no se puede leer el perfil no cierra la puerta', async () => {
    jest.spyOn(repositories.profiles, 'getCurrent').mockRejectedValue(new Error('sin red'));
    await renderRoute(
      <RequirePhoto>
        <Tabs />
      </RequirePhoto>
    );
    expect(await screen.findByText('pestañas')).toBeTruthy();
  });
});

describe('PhotoGateScreen', () => {
  it('solo entra con la foto aprobada por el servidor', async () => {
    await repositories.profiles.saveCurrent(buildProfileInput({ name: 'Marc' }));
    pick.mockResolvedValue({ status: 'picked', uri: 'file:///nueva.jpg' });
    let approve!: () => void;
    const real = repositories.profiles.setAvatarPhoto.bind(repositories.profiles);
    jest.spyOn(repositories.profiles, 'setAvatarPhoto').mockImplementation(
      (uri) =>
        new Promise((resolve) => {
          approve = () => void real(uri).then(resolve);
        })
    );

    await renderRoute(<PhotoGateScreen />);
    const primary = () => screen.getByRole('button', { name: 'Continuar' });
    expect(await screen.findByText('Pon tu foto de perfil')).toBeTruthy();
    // Sin flecha atrás: de aquí solo se sale con foto.
    expect(screen.queryByRole('button', { name: 'Volver' })).toBeNull();
    expect(primary()).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Añadir foto' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Elegir de la galería' }));
    expect(await screen.findByText('En revisión…')).toBeTruthy();
    expect(primary()).toBeDisabled();

    await act(async () => approve());
    expect(await screen.findByText('Foto aprobada')).toBeTruthy();
    expect(router.redirects).toEqual([]);

    await fireEvent.press(primary());
    await waitFor(() => expect(router.redirects).toEqual(['/discover']));
  });

  it('si el servidor rechaza la foto se queda, explica el motivo y no deja continuar', async () => {
    await repositories.profiles.saveCurrent(buildProfileInput());
    pick.mockResolvedValue({ status: 'picked', uri: 'file:///mala.jpg' });
    jest
      .spyOn(repositories.profiles, 'setAvatarPhoto')
      .mockRejectedValue(new Error('La foto no cumple las normas.'));

    await renderRoute(<PhotoGateScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Añadir foto' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Elegir de la galería' }));

    expect(await screen.findByText('La foto no cumple las normas.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    expect(router.redirects).toEqual([]);
  });

  it('quien ya tiene foto no se queda en la puerta', async () => {
    await repositories.profiles.saveCurrent(buildProfileInput());
    await repositories.profiles.setAvatarPhoto('file:///cara.jpg');
    await renderRoute(<PhotoGateScreen />);
    await waitFor(() => expect(router.redirects).toEqual(['/discover']));
  });
});
