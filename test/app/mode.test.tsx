/**
 * Tests del paso 1 del onboarding.
 *
 * La pantalla es una lista de tres tarjetas, pero tiene una regla que sí puede
 * romperse en silencio: el modo se guarda ANTES de navegar. Si se navegara
 * primero, el paso 2 arrancaría sin "qué busco" precargado y el deck sin
 * filtrar. También se prueba que un fallo al guardar no avance de pantalla y se
 * cuente, en vez de dejar a alguien en el paso 2 con la sesión a medias.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderRoute, repositories, resetRepositories, resetRouter, router } from '../routes';

import ModeScreen from '../../src/app/(onboarding)/mode';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

beforeEach(() => {
  resetRepositories();
  resetRouter();
});

describe('ModeScreen', () => {
  it('ofrece los tres modos y sitúa el paso en el onboarding', async () => {
    await renderRoute(<ModeScreen />);

    expect(screen.getByText('Paso 1 de 2')).toBeTruthy();
    expect(screen.getByText('Cofundador')).toBeTruthy();
    expect(screen.getByText('Compañero de Lock-In')).toBeTruthy();
    expect(screen.getByText('Ambos')).toBeTruthy();
  });

  it('no deja continuar sin elegir: no hay nada que guardar', async () => {
    await renderRoute(<ModeScreen />);

    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));

    expect(router.push).not.toHaveBeenCalled();
  });

  it('guarda el modo elegido antes de pasar al paso 2', async () => {
    await renderRoute(<ModeScreen />);

    await fireEvent.press(screen.getByText('Compañero de Lock-In'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/profile-form'));
    await expect(repositories.session.get()).resolves.toMatchObject({ activeMode: 'lockin' });
  });

  it('si el guardado falla se queda aquí y lo cuenta', async () => {
    jest
      .spyOn(repositories.session, 'setActiveMode')
      .mockRejectedValue(new Error('No hay conexión.'));

    await renderRoute(<ModeScreen />);

    await fireEvent.press(screen.getByText('Cofundador'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));

    await waitFor(() => expect(screen.getByText('No hay conexión.')).toBeTruthy());
    expect(router.push).not.toHaveBeenCalled();
  });
});
