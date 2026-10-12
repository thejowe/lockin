/**
 * Tests del paso 1 del onboarding: la bienvenida.
 *
 * Desde el 2026-10-12 no se elige modo —el producto es solo cofundador—, pero
 * la regla de antes sigue en pie: el modo `par` se guarda ANTES de navegar, y
 * un fallo al guardarlo no avanza de pantalla y se cuenta, en vez de dejar a
 * alguien en el paso 2 con la sesión a medias.
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
  it('presenta la app sin pedir que se elija modo', async () => {
    await renderRoute(<ModeScreen />);

    expect(screen.getByText('Encuentra con quién construir')).toBeTruthy();
    expect(screen.queryByText('Compañero de Lock-In')).toBeNull();
    expect(screen.queryByText(/Lock-In/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Continuar' })).not.toBeDisabled();
  });

  it('guarda el modo cofundador antes de pasar al paso 2', async () => {
    await renderRoute(<ModeScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/profile-form'));
    await expect(repositories.session.get()).resolves.toMatchObject({ activeMode: 'par' });
  });

  it('si el guardado falla se queda aquí y lo cuenta', async () => {
    jest
      .spyOn(repositories.session, 'setActiveMode')
      .mockRejectedValue(new Error('No hay conexión.'));

    await renderRoute(<ModeScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));

    await waitFor(() => expect(screen.getByText('No hay conexión.')).toBeTruthy());
    expect(router.push).not.toHaveBeenCalled();
  });
});
