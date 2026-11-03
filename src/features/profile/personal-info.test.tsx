/**
 * «Información personal» de Ajustes: correo y teléfono (privado), con el teléfono
 * editable en el sitio. Se esconde si no hay cuenta.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { PersonalInfo } from './personal-info';

const mockSetNotice = jest.fn();
const mockSavePhone = jest.fn();
let mockState: {
  account: {
    kind: string;
    email: string | null;
    pendingEmail: string | null;
    phone: string | null;
  } | null;
  busy: 'telefono' | null;
  notice: { text: string; tone: string } | null;
};

jest.mock('./use-account-actions', () => ({
  useAccountActions: () => ({
    ...mockState,
    setNotice: mockSetNotice,
    savePhone: mockSavePhone,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockState = {
    account: { kind: 'email', email: 'ana@example.com', pendingEmail: null, phone: '+34612345678' },
    busy: null,
    notice: null,
  };
});

describe('PersonalInfo', () => {
  it('sin cuenta no pinta nada', async () => {
    mockState.account = null;
    await render(<PersonalInfo />);

    expect(screen.queryByText('Información personal')).toBeNull();
  });

  it('enseña el correo y el teléfono de la cuenta', async () => {
    await render(<PersonalInfo />);

    expect(screen.getByText('ana@example.com')).toBeTruthy();
    expect(screen.getByText('+34612345678')).toBeTruthy();
  });

  it('con el correo pendiente de confirmar, enseña ese; sin teléfono, ofrece añadirlo', async () => {
    mockState.account = {
      kind: 'email',
      email: null,
      pendingEmail: 'nuevo@example.com',
      phone: null,
    };
    await render(<PersonalInfo />);

    expect(screen.getByText('nuevo@example.com')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Añadir teléfono' })).toBeTruthy();
  });

  it('editar parte del teléfono actual, guarda y vuelve a la vista', async () => {
    mockSavePhone.mockImplementation((_draft: string, onSaved: () => void) => onSaved());
    await render(<PersonalInfo />);

    await fireEvent.press(screen.getByRole('button', { name: 'Cambiar teléfono' }));
    expect(screen.getByLabelText('Teléfono de tu cuenta').props.value).toBe('+34612345678');
    await fireEvent.changeText(screen.getByLabelText('Teléfono de tu cuenta'), '+34 699 111 222');
    await fireEvent.press(screen.getByText('Guardar teléfono'));

    expect(mockSavePhone).toHaveBeenCalledWith('+34 699 111 222', expect.any(Function));
    expect(mockSetNotice).toHaveBeenLastCalledWith({
      text: 'Teléfono guardado.',
      tone: 'textSecondary',
    });
    expect(screen.queryByLabelText('Teléfono de tu cuenta')).toBeNull();
  });

  it('cancelar vuelve a la vista sin guardar', async () => {
    await render(<PersonalInfo />);

    await fireEvent.press(screen.getByRole('button', { name: 'Cambiar teléfono' }));
    await fireEvent.press(screen.getByText('Cancelar'));

    expect(mockSavePhone).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Teléfono de tu cuenta')).toBeNull();
  });

  it('muestra el aviso pendiente', async () => {
    mockState.notice = { text: 'Ese número no existe.', tone: 'danger' };
    await render(<PersonalInfo />);

    expect(screen.getByText('Ese número no existe.')).toBeTruthy();
  });
});
