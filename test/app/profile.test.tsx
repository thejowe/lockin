/**
 * Tests de la tab Perfil.
 *
 * Tiene tres estados y la pantalla los elige sola: sin ficha (aterrizaje con la
 * sesión a medias), ficha en lectura, y ficha en edición. El que más importa es
 * el tercero, porque al guardar tiene que cerrar la edición Y releer: si solo
 * cerrara, la ficha seguiría enseñando los datos viejos hasta cambiar de tab.
 *
 * `ProfileForm` se sustituye por un doble — el formulario ya tiene sus propios
 * tests en `perfil` y aquí solo interesa cuándo se monta y qué se hace con lo
 * que envía.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { buildProfileInput } from '@/data/test-fixtures';

import { renderRoute, repositories, resetRepositories, resetRouter, router } from '../routes';

import ProfileScreen from '../../src/app/(tabs)/profile';

import type { ProfileFormProps } from '@/features/profile';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

/** Lo que envía el doble del formulario al pulsar su botón. */
const mockEdited = buildProfileInput({ name: 'Núria Bosch', location: 'Girona' });

jest.mock('@/features/profile', () => {
  const actual = jest.requireActual('@/features/profile');
  const { Pressable, Text } = require('react-native');

  return {
    ...actual,
    ProfileForm: (props: ProfileFormProps) => (
      <>
        {props.header}
        <Pressable accessibilityRole="button" onPress={() => props.onSubmit(mockEdited)}>
          <Text>{props.submitLabel}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={props.onCancel}>
          <Text>{props.cancelLabel}</Text>
        </Pressable>
      </>
    ),
  };
});

/** Deja una ficha guardada antes de montar la pantalla. */
async function withProfile(name = 'Perfil Prueba') {
  return repositories.profiles.saveCurrent(buildProfileInput({ name }));
}

beforeEach(() => {
  resetRepositories();
  resetRouter();
});

describe('ProfileScreen', () => {
  describe('sin ficha', () => {
    it('no deja la tab en blanco: explica y ofrece crearla', async () => {
      await renderRoute(<ProfileScreen />);

      await waitFor(() => expect(screen.getByText('Todavía no tienes ficha')).toBeTruthy());
      expect(screen.getByRole('button', { name: 'Crear perfil' })).toBeTruthy();
    });

    it('crear perfil sustituye la ruta por el onboarding', async () => {
      await renderRoute(<ProfileScreen />);
      await waitFor(() => expect(screen.getByText('Todavía no tienes ficha')).toBeTruthy());

      await fireEvent.press(screen.getByRole('button', { name: 'Crear perfil' }));

      expect(router.replace).toHaveBeenCalledWith('/mode');
      expect(router.push).not.toHaveBeenCalled();
    });
  });

  describe('con ficha', () => {
    it('la enseña en lectura, con la salida a editar', async () => {
      await withProfile();

      await renderRoute(<ProfileScreen />);

      await waitFor(() => expect(screen.getByText('Perfil')).toBeTruthy());
      expect(screen.getByRole('button', { name: 'Editar perfil' })).toBeTruthy();
      expect(screen.queryByText('Guardar cambios')).toBeNull();
    });

    it('editar monta el formulario sobre la ficha actual', async () => {
      await withProfile();

      await renderRoute(<ProfileScreen />);
      await waitFor(() => expect(screen.getByText('Perfil')).toBeTruthy());

      await fireEvent.press(screen.getByRole('button', { name: 'Editar perfil' }));

      expect(screen.getByText('Editar perfil')).toBeTruthy();
      expect(screen.getByText('Tu ficha')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeTruthy();
    });

    it('descartar vuelve a lectura sin tocar los datos', async () => {
      await withProfile('Perfil Prueba');

      await renderRoute(<ProfileScreen />);
      await waitFor(() => expect(screen.getByText('Perfil')).toBeTruthy());
      await fireEvent.press(screen.getByRole('button', { name: 'Editar perfil' }));

      await fireEvent.press(screen.getByRole('button', { name: 'Descartar cambios' }));

      expect(screen.queryByText('Guardar cambios')).toBeNull();
      await expect(repositories.profiles.getCurrent()).resolves.toMatchObject({
        name: 'Perfil Prueba',
      });
    });

    it('guardar cierra la edición y relee: la ficha no se queda con lo viejo', async () => {
      await withProfile('Perfil Prueba');

      await renderRoute(<ProfileScreen />);
      await waitFor(() => expect(screen.getByText('Perfil')).toBeTruthy());
      await fireEvent.press(screen.getByRole('button', { name: 'Editar perfil' }));

      await fireEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }));

      await waitFor(() => expect(screen.queryByText('Guardar cambios')).toBeNull());
      await waitFor(() => expect(screen.getByText('Núria Bosch')).toBeTruthy());
      expect(screen.queryByText('Perfil Prueba')).toBeNull();
    });
  });
});
