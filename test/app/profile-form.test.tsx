/**
 * Tests del paso 2 del onboarding.
 *
 * La pantalla no dibuja el formulario, lo compone: lo que decide es esperar al
 * modo del paso 1 antes de montarlo (si llegara después, "qué busco" ya estaría
 * inicializado en vacío) y usar `replace` al terminar, para que el botón atrás
 * no devuelva a nadie a un onboarding ya hecho.
 *
 * `ProfileForm` se sustituye por un doble que guarda sus props y pinta su
 * cabecera: montar el formulario real aquí duplicaría `profile-form.test.tsx`
 * de `perfil` y taparía justo lo que esta pantalla aporta.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { buildProfileInput } from '@/data/test-fixtures';

import { renderRoute, repositories, resetRepositories, resetRouter, router } from '../routes';

import ProfileFormScreen from '../../src/app/(onboarding)/profile-form';

import type { ProfileFormProps } from '@/features/profile';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

/**
 * Props con las que se montó el formulario. El prefijo `mock` es lo que deja a
 * `jest.mock` cerrar sobre una variable de este módulo.
 */
const mockForm: { props: ProfileFormProps | null } = { props: null };

/** Lo que envía el doble al pulsar: el perfil ya relleno. */
const mockInput = buildProfileInput({ name: 'Núria Bosch' });

jest.mock('@/features/profile', () => {
  const { Pressable, Text } = require('react-native');

  return {
    ProfileForm: (props: ProfileFormProps) => {
      mockForm.props = props;
      return (
        <>
          {props.header}
          <Pressable accessibilityRole="button" onPress={() => props.onSubmit(mockInput)}>
            <Text>{props.submitLabel}</Text>
          </Pressable>
        </>
      );
    },
  };
});

beforeEach(() => {
  mockForm.props = null;
  resetRepositories();
  resetRouter();
});

describe('ProfileFormScreen', () => {
  it('sitúa el paso y explica qué se pide en la cabecera del formulario', async () => {
    await renderRoute(<ProfileFormScreen />);

    expect(screen.getByText('Paso 2 de 2')).toBeTruthy();
    expect(screen.getByText('Cuéntate')).toBeTruthy();
    expect(screen.getByText('Crear perfil')).toBeTruthy();
  });

  it('precarga "qué busco" con el modo elegido en el paso 1', async () => {
    await repositories.session.setActiveMode('lockin');

    await renderRoute(<ProfileFormScreen />);

    await waitFor(() => expect(mockForm.props?.defaultLookingFor).toBe('lockin'));
  });

  it('sin modo guardado monta el formulario sin precargar nada', async () => {
    await renderRoute(<ProfileFormScreen />);

    await waitFor(() => expect(mockForm.props).not.toBeNull());
    expect(mockForm.props?.defaultLookingFor).toBeNull();
  });

  it('guarda el perfil y sustituye la ruta: atrás no vuelve al onboarding', async () => {
    await renderRoute(<ProfileFormScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Crear perfil' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/discover'));
    expect(router.push).not.toHaveBeenCalled();
    await expect(repositories.profiles.getCurrent()).resolves.toMatchObject({
      name: 'Núria Bosch',
    });
  });
});
