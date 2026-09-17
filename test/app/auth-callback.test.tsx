/**
 * Test de la ruta `lockin://auth/callback`.
 *
 * La ruta no decide nada más que a dónde sigue la persona cuando el enlace ya
 * está aplicado — la lógica vive en `AuthCallback`, que tiene sus propios tests
 * en `src/features/profile/`. Lo que se comprueba aquí es justo eso: que el
 * destino es el perfil y que se llega con `replace`, porque el código del
 * enlace es de un solo uso y volver atrás a esta pantalla no lleva a ningún
 * sitio.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, screen } from '@testing-library/react-native';

import { renderRoute, resetRepositories, resetRouter, router } from '../routes';

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
  it('al terminar, sustituye la ruta por el perfil', async () => {
    await renderRoute(<AuthCallbackRoute />);

    await fireEvent.press(screen.getByRole('button', { name: 'terminado' }));

    expect(router.replace).toHaveBeenCalledWith('/profile');
    expect(router.push).not.toHaveBeenCalled();
  });
});
