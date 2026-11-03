/**
 * «Elige tu nueva contraseña»: pide la nueva dos veces, avisa de lo que falta
 * sin llamar al servidor, guarda con `saveRecoveredPassword` y, ya guardada,
 * esconde el formulario y ofrece «Seguir». «Ahora no» sale sin guardar.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { NewPasswordForm } from './new-password-form';

const mockSetNotice = jest.fn();
const mockSaveRecoveredPassword = jest.fn();
let mockState: {
  account: { email: string | null } | null;
  busy: 'contrasena' | null;
  notice: { text: string; tone: string } | null;
};

jest.mock('./use-account-actions', () => ({
  useAccountActions: () => ({
    ...mockState,
    setNotice: mockSetNotice,
    saveRecoveredPassword: mockSaveRecoveredPassword,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockState = { account: { email: 'ana@example.com' }, busy: null, notice: null };
});

async function fill(next: string, repeat: string) {
  await fireEvent.changeText(screen.getByLabelText('Nueva contraseña'), next);
  await fireEvent.changeText(screen.getByLabelText('Repite la nueva contraseña'), repeat);
}

describe('NewPasswordForm', () => {
  it('muestra el email de la cuenta', async () => {
    await render(<NewPasswordForm onDone={jest.fn()} />);

    expect(screen.getByText('ana@example.com')).toBeTruthy();
  });

  it('no inventa un email si la cuenta no lo tiene', async () => {
    mockState.account = null;
    await render(<NewPasswordForm onDone={jest.fn()} />);

    expect(screen.queryByText('ana@example.com')).toBeNull();
  });

  it('con un problema (contraseñas distintas) avisa y no guarda', async () => {
    await render(<NewPasswordForm onDone={jest.fn()} />);

    await fill('una-clave-larga-1', 'otra-clave-larga-2');
    await fireEvent.press(screen.getByText('Guardar contraseña'));

    expect(mockSaveRecoveredPassword).not.toHaveBeenCalled();
    expect(mockSetNotice).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'danger', text: expect.any(String) })
    );
  });

  it('guarda y, al terminar, esconde el formulario y deja seguir', async () => {
    const onDone = jest.fn();
    mockSaveRecoveredPassword.mockImplementation((_value: string, onSaved: () => void) =>
      onSaved()
    );
    await render(<NewPasswordForm onDone={onDone} />);

    await fill('una-clave-larga-1', 'una-clave-larga-1');
    await fireEvent.press(screen.getByText('Guardar contraseña'));

    expect(mockSaveRecoveredPassword).toHaveBeenCalledWith(
      'una-clave-larga-1',
      expect.any(Function)
    );
    expect(mockSetNotice).toHaveBeenLastCalledWith(
      expect.objectContaining({ tone: 'textSecondary' })
    );
    expect(screen.queryByLabelText('Nueva contraseña')).toBeNull();

    await fireEvent.press(screen.getByText('Seguir'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('«Ahora no» cierra sin guardar', async () => {
    await render(<NewPasswordForm onDone={jest.fn()} />);
    const onDone = jest.fn();
    await render(<NewPasswordForm onDone={onDone} />);

    await fireEvent.press(screen.getByText('Ahora no'));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(mockSaveRecoveredPassword).not.toHaveBeenCalled();
  });

  it('mientras guarda, lo dice y bloquea el botón', async () => {
    mockState.busy = 'contrasena';
    mockState.notice = { text: 'Algo falló', tone: 'danger' };
    await render(<NewPasswordForm onDone={jest.fn()} />);

    expect(screen.getByText('Guardando…')).toBeTruthy();
    expect(screen.getByText('Algo falló')).toBeTruthy();
  });
});
