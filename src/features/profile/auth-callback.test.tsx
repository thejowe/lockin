/**
 * Tests de la vuelta del enlace del correo.
 *
 * Lo que importa de esta pantalla es que no deje a nadie colgado: un enlace
 * bueno tiene que devolver a la persona a su perfil, y uno caducado tiene que
 * decir qué pasó y ofrecer una salida, no quedarse en «un momento…» para
 * siempre.
 *
 * Y una cosa que no se ve pero rompe el flujo: el `code` del enlace es de un
 * solo uso, así que solo se puede canjear una vez por mucho que el componente
 * vuelva a renderizarse.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Linking from 'expo-linking';

import { AuthCallback } from './auth-callback';

jest.mock('expo-linking', () => ({ useURL: jest.fn() }));

jest.mock('./account-gateway', () => ({
  ...jest.requireActual('./account-gateway'),
  completeAuthLink: jest.fn(),
}));

const gateway = jest.requireMock('./account-gateway') as {
  AccountError: typeof import('./account-gateway').AccountError;
  completeAuthLink: jest.Mock;
};

const useURL = Linking.useURL as jest.Mock;

const ENLACE = 'lockin://auth/callback?code=abc123';

let onDone: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  onDone = jest.fn();
  useURL.mockReturnValue(ENLACE);
  gateway.completeAuthLink.mockResolvedValue({
    kind: 'email',
    userId: 'uid-1',
    email: 'ana@example.com',
    pendingEmail: null,
    recoverable: true,
  });
});

describe('AuthCallback', () => {
  it('aplica el enlace y devuelve a la persona a su perfil', async () => {
    await render(<AuthCallback onDone={onDone} />);

    await waitFor(() => expect(gateway.completeAuthLink).toHaveBeenCalledWith(ENLACE));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('mientras no llega la URL no canjea nada', async () => {
    useURL.mockReturnValue(null);

    await render(<AuthCallback onDone={onDone} />);

    expect(gateway.completeAuthLink).not.toHaveBeenCalled();
    expect(screen.getByText('Un momento…')).toBeTruthy();
  });

  it('el código es de un solo uso: no se canjea dos veces', async () => {
    const { rerender } = await render(<AuthCallback onDone={onDone} />);
    await waitFor(() => expect(gateway.completeAuthLink).toHaveBeenCalledTimes(1));

    await rerender(<AuthCallback onDone={onDone} />);

    expect(gateway.completeAuthLink).toHaveBeenCalledTimes(1);
  });

  it('un enlace caducado se explica y deja una salida', async () => {
    gateway.completeAuthLink.mockRejectedValue(
      new gateway.AccountError('unknown', 'El enlace ya no sirve. Pide otro correo.')
    );

    await render(<AuthCallback onDone={onDone} />);

    await waitFor(() => expect(screen.getByText('Ese enlace no ha funcionado')).toBeTruthy());
    expect(screen.getByText('El enlace ya no sirve. Pide otro correo.')).toBeTruthy();
    expect(screen.getByText(/Tu cuenta no ha cambiado/)).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Volver a mi perfil' }));
    expect(onDone).toHaveBeenCalled();
  });

  it('un fallo sin mensaje tampoco se queda mudo', async () => {
    gateway.completeAuthLink.mockRejectedValue('vaya');

    await render(<AuthCallback onDone={onDone} />);

    await waitFor(() => expect(screen.getByText('Ese enlace no ha funcionado')).toBeTruthy());
    expect(screen.getByText('Ese enlace no ha funcionado.')).toBeTruthy();
  });
});
