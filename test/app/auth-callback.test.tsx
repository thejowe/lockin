/**
 * Test de la ruta `lockin://auth/callback`.
 *
 * La ruta no decide nada más que a dónde sigue la persona cuando el enlace ya
 * está aplicado — la lógica vive en `AuthCallback`, que tiene sus propios tests
 * en `src/features/profile/`. Lo que se comprueba aquí es justo eso, y depende
 * de quién sea:
 *
 * - con perfil viene de la tab Perfil (asegurar la cuenta, cambiar la
 *   contraseña) y vuelve allí;
 * - sin perfil está en pleno alta y le falta elegir la contraseña, que se pide
 *   en `/register`; mandarla a `/profile` la dejaría en una tab vacía;
 * - si no se puede saber si hay perfil, a la puerta de entrada, que sabe
 *   enseñar el fallo.
 *
 * Y siempre con `replace`, porque el código del enlace es de un solo uso y
 * volver atrás a esta pantalla no lleva a ningún sitio.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { buildProfileInput } from '@/data/test-fixtures';

import { renderRoute, repositories, resetRepositories, resetRouter, router } from '../routes';

import AuthCallbackRoute from '../../src/app/auth/callback';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

jest.mock('@/features/profile', () => {
  const { Pressable, Text } = require('react-native');

  return {
    AuthCallback: ({ onDone }: { onDone: () => void }) => (
      <Pressable accessibilityRole="button" onPress={onDone}>
        <Text>terminado</Text>
      </Pressable>
    ),
  };
});

beforeEach(() => {
  resetRepositories();
  resetRouter();
});

describe('AuthCallbackRoute', () => {
  it('con perfil, sustituye la ruta por la tab Perfil', async () => {
    await repositories.session.setActiveMode('par');
    await repositories.profiles.saveCurrent(buildProfileInput());
    await renderRoute(<AuthCallbackRoute />);

    await fireEvent.press(screen.getByRole('button', { name: 'terminado' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/profile'));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('sin perfil está en pleno alta: sigue en el registro, donde se elige la contraseña', async () => {
    await renderRoute(<AuthCallbackRoute />);

    await fireEvent.press(screen.getByRole('button', { name: 'terminado' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/register'));
    expect(router.replace).not.toHaveBeenCalledWith('/profile');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('si no se puede saber si hay perfil, va a la puerta de entrada', async () => {
    jest.spyOn(repositories.session, 'isOnboarded').mockRejectedValue(new Error('Sin conexión.'));
    await renderRoute(<AuthCallbackRoute />);

    await fireEvent.press(screen.getByRole('button', { name: 'terminado' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(router.push).not.toHaveBeenCalled();
  });
});
