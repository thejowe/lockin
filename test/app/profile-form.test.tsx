/**
 * Tests del último paso del onboarding (el asistente del perfil y la entrada animada).
 *
 * La pantalla no dibuja el formulario, lo compone: lo que decide es esperar al
 * modo del paso 1 antes de montarlo (si llegara después, "qué busco" ya estaría
 * inicializado en vacío) y usar `replace` al terminar, para que el botón atrás
 * no devuelva a nadie a un onboarding ya hecho.
 *
 * `ProfileWizard` se sustituye por un doble que guarda sus props: montar el
 * asistente real aquí duplicaría `profile-wizard.test.tsx` de `perfil` y taparía
 * justo lo que esta pantalla aporta. La puerta del
 * registro obligatorio (`useRegistrationGate`) se sustituye por un valor que el
 * test elige: su lógica se prueba en `src/features/profile/`.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { buildProfileInput } from '@/data/test-fixtures';

import { renderRoute, repositories, resetRepositories, resetRouter, router } from '../routes';

import { SPLASH_MS } from '@/components/welcome-splash';

import ProfileFormScreen from '../../src/app/(onboarding)/profile-form';

import type { ComponentProps } from 'react';

import type { ProfileWizard } from '@/features/profile';

type WizardProps = ComponentProps<typeof ProfileWizard>;

jest.mock('expo-router', () => require('../routes').expoRouterMock());

/**
 * Props con las que se montó el formulario. El prefijo `mock` es lo que deja a
 * `jest.mock` cerrar sobre una variable de este módulo.
 */
const mockForm: { props: WizardProps | null } = { props: null };

/** Lo que envía el doble al pulsar: el perfil ya relleno. */
const mockInput = buildProfileInput({ name: 'Núria Bosch' });

/** Lo que responde la puerta del registro en cada test. */
const mockGate: { value: 'checking' | 'required' | 'open' } = { value: 'open' };

/** Lo que responde la puerta de Términos y Normas en cada test. */
const mockTerms: { value: 'checking' | 'accepted' | 'required' } = { value: 'accepted' };

jest.mock('@/features/profile', () => {
  const { Pressable, Text } = require('react-native');

  return {
    useRegistrationGate: () => mockGate.value,
    useTermsGate: () => ({ gate: mockTerms.value, refresh: jest.fn() }),
    TermsAcceptance: () => <Text>Términos y Normas</Text>,
    ProfileWizard: (props: WizardProps) => {
      mockForm.props = props;
      return (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() => props.onSubmit(mockInput).catch(() => undefined)}>
            <Text>{props.submitLabel}</Text>
          </Pressable>
        </>
      );
    },
  };
});

beforeEach(() => {
  mockForm.props = null;
  mockGate.value = 'open';
  mockTerms.value = 'accepted';
  resetRepositories();
  resetRouter();
});

describe('ProfileFormScreen', () => {
  describe('puerta del registro obligatorio', () => {
    it('sin cuenta creada manda a /register en vez de pintar el formulario', async () => {
      mockGate.value = 'required';

      await renderRoute(<ProfileFormScreen />);

      expect(router.redirects).toEqual(['/register']);
      expect(mockForm.props).toBeNull();
    });

    it('mientras comprueba la cuenta no pinta nada ni redirige', async () => {
      mockGate.value = 'checking';

      await renderRoute(<ProfileFormScreen />);

      expect(router.redirects).toEqual([]);
      expect(mockForm.props).toBeNull();
      expect(screen.queryByText('Crear perfil')).toBeNull();
    });
  });

  it('sin Términos y Normas aceptados pide la aceptación en vez de pintar el formulario', async () => {
    mockTerms.value = 'required';

    await renderRoute(<ProfileFormScreen />);

    expect(screen.getByText('Términos y Normas')).toBeTruthy();
    expect(mockForm.props).toBeNull();
  });

  it('monta el formulario sin esperar a ningún modo: ya no se elige', async () => {
    await renderRoute(<ProfileFormScreen />);

    await waitFor(() => expect(mockForm.props).not.toBeNull());
  });

  it('guarda el perfil y sustituye la ruta: atrás no vuelve al onboarding', async () => {
    await renderRoute(<ProfileFormScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Crear perfil' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Entrar a cofounder' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/discover'));
    expect(router.push).not.toHaveBeenCalled();
    await expect(repositories.profiles.getCurrent()).resolves.toMatchObject({
      name: 'Núria Bosch',
    });
  });

  it('al terminar enseña la animación del logo y, sin tocar, entra sola cuando acaba', async () => {
    jest.useFakeTimers();
    try {
      await renderRoute(<ProfileFormScreen />);

      await fireEvent.press(screen.getByRole('button', { name: 'Crear perfil' }));
      expect(await screen.findByLabelText('cofounder')).toBeTruthy();
      expect(router.replace).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(SPLASH_MS + 100);

      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/discover'));
    } finally {
      jest.useRealTimers();
    }
  });

  it('si el guardado falla, quita la animación y deja el asistente donde estaba', async () => {
    await renderRoute(<ProfileFormScreen />);
    jest.spyOn(repositories.profiles, 'saveCurrent').mockRejectedValueOnce(new Error('sin red'));

    await fireEvent.press(screen.getByRole('button', { name: 'Crear perfil' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Entrar a cofounder' })).toBeNull()
    );
    expect(router.replace).not.toHaveBeenCalled();
  });
});
