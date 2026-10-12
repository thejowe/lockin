/**
 * Tests de la puerta del correo: solo `open` deja ver lo de dentro.
 *
 * El hook se sustituye por un doble: lo que se prueba aquí es qué pinta cada
 * estado, no cómo se calcula (eso ya lo cubre `useRegistrationGate`).
 *
 * Ojo: en RNTL 14 `render` es asíncrono.
 */

import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { RequireVerifiedEmail } from './require-verified-email';

const mockRedirect = jest.fn();

jest.mock('expo-router', () => ({
  Redirect: (props: { href: string }) => {
    mockRedirect(props.href);
    return null;
  },
}));

jest.mock('./use-registration-gate', () => ({ useRegistrationGate: jest.fn() }));

const useGate = jest.requireMock('./use-registration-gate').useRegistrationGate as jest.Mock;

function ui() {
  return (
    <RequireVerifiedEmail>
      <Text>contenido privado</Text>
    </RequireVerifiedEmail>
  );
}

describe('RequireVerifiedEmail', () => {
  beforeEach(() => {
    mockRedirect.mockClear();
  });

  it('con la cuenta abierta enseña el contenido', async () => {
    useGate.mockReturnValue('open');
    await render(ui());

    expect(screen.getByText('contenido privado')).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('sin email confirmado manda a /register y no enseña nada', async () => {
    useGate.mockReturnValue('required');
    await render(ui());

    expect(mockRedirect).toHaveBeenCalledWith('/register');
    expect(screen.queryByText('contenido privado')).toBeNull();
  });

  it('mientras comprueba no enseña el contenido ni redirige', async () => {
    useGate.mockReturnValue('checking');
    await render(ui());

    expect(screen.getByText('Comprobando tu cuenta…')).toBeTruthy();
    expect(screen.queryByText('contenido privado')).toBeNull();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
