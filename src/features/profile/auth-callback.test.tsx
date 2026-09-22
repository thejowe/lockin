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
import { AuthCallback, authLinkFromParams } from './auth-callback';

jest.mock('./account-gateway', () => ({
  ...jest.requireActual('./account-gateway'),
  completeAuthLink: jest.fn(),
}));

const gateway = jest.requireMock('./account-gateway') as {
  AccountError: typeof import('./account-gateway').AccountError;
  completeAuthLink: jest.Mock;
};

const ENLACE = 'lockin://auth/callback?code=abc123';

let onDone: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  onDone = jest.fn();
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
    await render(<AuthCallback url={ENLACE} onDone={onDone} />);

    await waitFor(() => expect(gateway.completeAuthLink).toHaveBeenCalledWith(ENLACE));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('mientras no llega la URL no canjea nada', async () => {
    await render(<AuthCallback url={null} onDone={onDone} />);

    expect(gateway.completeAuthLink).not.toHaveBeenCalled();
    expect(screen.getByText('Un momento…')).toBeTruthy();
  });

  it('el código es de un solo uso: no se canjea dos veces', async () => {
    const { rerender } = await render(<AuthCallback url={ENLACE} onDone={onDone} />);
    await waitFor(() => expect(gateway.completeAuthLink).toHaveBeenCalledTimes(1));

    await rerender(<AuthCallback url={ENLACE} onDone={onDone} />);

    expect(gateway.completeAuthLink).toHaveBeenCalledTimes(1);
  });

  it('un enlace caducado se explica y deja una salida', async () => {
    gateway.completeAuthLink.mockRejectedValue(
      new gateway.AccountError('unknown', 'El enlace ya no sirve. Pide otro correo.')
    );

    await render(<AuthCallback url={ENLACE} onDone={onDone} />);

    await waitFor(() => expect(screen.getByText('Ese enlace no ha funcionado')).toBeTruthy());
    expect(screen.getByText('El enlace ya no sirve. Pide otro correo.')).toBeTruthy();
    expect(screen.getByText(/Tu cuenta no ha cambiado/)).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Volver a mi perfil' }));
    expect(onDone).toHaveBeenCalled();
  });

  it('un fallo sin mensaje tampoco se queda mudo', async () => {
    gateway.completeAuthLink.mockRejectedValue('vaya');

    await render(<AuthCallback url={ENLACE} onDone={onDone} />);

    await waitFor(() => expect(screen.getByText('Ese enlace no ha funcionado')).toBeTruthy());
    expect(screen.getByText('Ese enlace no ha funcionado.')).toBeTruthy();
  });
  it('llega en caliente: la URL puede aparecer después de montarse', async () => {
    const { rerender } = await render(<AuthCallback url={null} onDone={onDone} />);
    expect(gateway.completeAuthLink).not.toHaveBeenCalled();

    await rerender(<AuthCallback url={ENLACE} onDone={onDone} />);

    await waitFor(() => expect(gateway.completeAuthLink).toHaveBeenCalledWith(ENLACE));
  });
});

describe('authLinkFromParams', () => {
  it('rehace el enlace de PKCE con los parámetros de la ruta', () => {
    expect(authLinkFromParams({ code: 'abc123' })).toBe(ENLACE);
  });

  it('conserva token_hash, type y los errores, y toma el primero de un array', () => {
    const url = authLinkFromParams({ token_hash: ['h1', 'h2'], type: 'email_change' });
    expect(new URL(url!).searchParams.get('token_hash')).toBe('h1');
    expect(new URL(url!).searchParams.get('type')).toBe('email_change');
    const failed = authLinkFromParams({ error: 'access_denied', error_description: 'expired' });
    expect(new URL(failed!).searchParams.get('error_description')).toBe('expired');
  });

  it('sin parámetros de cuenta no hay enlace', () => {
    expect(authLinkFromParams({})).toBeNull();
    expect(authLinkFromParams({ otro: 'x' })).toBeNull();
  });
});
