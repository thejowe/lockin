/**
 * Tests de la bienvenida (`/mode`), desde el 2026-10-17: logo y dos salidas.
 *
 * Desde el 2026-10-12 no se elige modo —el producto es solo cofundador—, pero
 * la regla de antes sigue en pie: el modo `par` se guarda ANTES de navegar, y
 * un fallo al guardarlo no avanza de pantalla y se cuenta, en vez de dejar a
 * alguien en el alta con la sesión a medias.
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

describe('WelcomeScreen', () => {
  it('presenta la marca y «Registrarse», sin pedir que se elija modo', async () => {
    await renderRoute(<ModeScreen />);

    expect(screen.getByRole('image', { name: 'cofounder' })).toBeTruthy();
    expect(screen.getByText('cofounder')).toBeTruthy();
    expect(screen.queryByText(/Lock-In/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Registrarse' })).not.toBeDisabled();
  });

  it('«Registrarse» guarda el modo cofundador y empieza por «Sobre ti»', async () => {
    await renderRoute(<ModeScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Registrarse' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/about-you'));
    await expect(repositories.session.get()).resolves.toMatchObject({ activeMode: 'par' });
  });

  it('si el guardado falla se queda aquí y lo cuenta', async () => {
    jest
      .spyOn(repositories.session, 'setActiveMode')
      .mockRejectedValue(new Error('No hay conexión.'));

    await renderRoute(<ModeScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Registrarse' }));

    await waitFor(() => expect(screen.getByText('No hay conexión.')).toBeTruthy());
    expect(router.push).not.toHaveBeenCalled();
  });
});
