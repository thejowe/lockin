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

/**
 * La sección de cuenta llega hasta Supabase, que aquí no existe: sin
 * credenciales `readAccountState()` devuelve `null` y no pintaría nada. Se
 * sustituye por una cuenta anónima —la que tiene cualquiera que acabe de
 * entrar— para poder comprobar que la tab la monta. Lo que la sección hace con
 * cada estado se prueba en `src/features/profile/account-section.test.tsx`.
 */
jest.mock('@/features/profile/account-gateway', () => ({
  ...jest.requireActual('@/features/profile/account-gateway'),
  readAccountState: jest.fn(() =>
    Promise.resolve({
      kind: 'anonymous',
      userId: 'uid-1',
      email: null,
      pendingEmail: null,
      recoverable: false,
    })
  ),
}));

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

    /**
     * El caso que no cubre ninguna otra pantalla: si la persona se renombra en
     * GitHub, el sello se queda apuntando al handle viejo. Se resincroniza al
     * abrir la ficha, no en cada arranque — sería una llamada de red en el
     * camino crítico de inicio para un caso raro.
     */
    describe('sello de GitHub', () => {
      it('al abrir la ficha, resincroniza el sello', async () => {
        await withProfile();
        await repositories.profiles.verifyGithub();
        const sync = jest.spyOn(repositories.profiles, 'refreshGithubVerification');

        await renderRoute(<ProfileScreen />);

        await waitFor(() => expect(sync).toHaveBeenCalled());
      });

      it('no resincroniza si no hay sello que refrescar', async () => {
        await withProfile();
        const sync = jest.spyOn(repositories.profiles, 'refreshGithubVerification');

        await renderRoute(<ProfileScreen />);

        await waitFor(() => expect(screen.getByText('Perfil')).toBeTruthy());
        expect(sync).not.toHaveBeenCalled();
      });

      it('si la resincronización falla, la ficha sigue enseñando el sello que tenía', async () => {
        // Sincronizar es oportunista: quien abre su perfil no venía a que le
        // contaran que la red va mal, y el último handle conocido sigue siendo
        // lo último que se sabe cierto.
        await withProfile();
        await repositories.profiles.verifyGithub();
        jest
          .spyOn(repositories.profiles, 'refreshGithubVerification')
          .mockRejectedValue(new Error('sin red'));

        await renderRoute(<ProfileScreen />);

        await waitFor(() => expect(screen.getByText('Quitar verificación')).toBeTruthy());
        expect(screen.queryByText('Verificar con GitHub')).toBeNull();
      });

      it('la ficha ofrece verificar sin salir de la tab', async () => {
        await withProfile();

        await renderRoute(<ProfileScreen />);

        await waitFor(() => expect(screen.getByText('Verificar con GitHub')).toBeTruthy());
      });
    });

    /**
     * La cuenta de quien no ha vinculado email vive solo en este teléfono, y
     * hasta la orden `P1` la app no lo decía en ninguna parte. La tab Perfil es
     * el sitio donde se dice y el único desde el que se puede arreglar.
     */
    it('la ficha avisa de que la cuenta vive solo en este teléfono', async () => {
      await withProfile();

      await renderRoute(<ProfileScreen />);

      await waitFor(() =>
        expect(screen.getByText('Tus datos viven solo en este teléfono')).toBeTruthy()
      );
      expect(screen.getByRole('button', { name: 'Asegurar mi cuenta' })).toBeTruthy();
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
