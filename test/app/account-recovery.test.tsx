import { fireEvent, screen } from '@testing-library/react-native';
import { renderRoute, resetRepositories, resetRouter, router, setSearchParams } from '../routes';
import UnblockScreen from '../../src/app/(onboarding)/unblock';
import ResetPasswordRoute from '../../src/app/reset-password';
import { RequestUnblockButton } from '@/features/profile/unblock-request-form';

jest.mock('expo-router', () => jest.requireActual('../routes').expoRouterMock());
let mockAvailable = true;
const mockRequest = jest.fn();
jest.mock('@/features/profile/account-gateway', () => {
  const gateway = {
    ...jest.requireActual('@/features/profile/account-gateway'),
    requestAccountUnblock: (...args: unknown[]) => mockRequest(...args),
    readAccountState: async () => ({
      kind: 'email',
      userId: 'me',
      email: 'user@example.org',
      recoverable: true,
    }),
  };
  Object.defineProperty(gateway, 'accountsAvailable', { get: () => mockAvailable });
  return gateway;
});

beforeEach(() => {
  resetRouter();
  resetRepositories();
  setSearchParams({});
  mockAvailable = true;
  mockRequest.mockReset();
});

it('el aviso de cuenta bloqueada abre el formulario con el correo sin espacios', async () => {
  await renderRoute(<RequestUnblockButton email="  user@example.org  " />);
  await fireEvent.press(screen.getByRole('button', { name: 'Solicitar desbloqueo' }));
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/unblock',
    params: { email: 'user@example.org' },
  });
});

it('la solicitud exige un motivo, conserva los datos tras un fallo y vuelve atrás al enviarla', async () => {
  setSearchParams({ email: 'user@example.org' });
  mockRequest
    .mockRejectedValueOnce(new Error('Network request failed'))
    .mockResolvedValueOnce(undefined);
  await renderRoute(<UnblockScreen />);
  expect(screen.getByDisplayValue('user@example.org')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Enviar solicitud' })).toBeDisabled();
  const reason = 'Quiero volver a registrarme con esta dirección de correo.';
  await fireEvent.changeText(screen.getByLabelText('Motivo del desbloqueo'), reason);
  await fireEvent.press(screen.getByRole('button', { name: 'Enviar solicitud' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/conexión/);
  await fireEvent.press(screen.getByRole('button', { name: 'Enviar solicitud' }));
  expect(mockRequest).toHaveBeenLastCalledWith('user@example.org', reason);
  expect(await screen.findByText('Solicitud enviada')).toBeOnTheScreen();
  await fireEvent.press(screen.getByText('Volver'));
  expect(router.back).toHaveBeenCalledTimes(1);
});

it('una URL de desbloqueo ambigua deja el correo vacío y cancelar un enlace directo vuelve a la entrada', async () => {
  setSearchParams({ email: ['one', 'two'] });
  router.canGoBack.mockReturnValue(false);
  await renderRoute(<UnblockScreen />);
  expect(screen.getByLabelText('Correo de la cuenta eliminada')).toHaveDisplayValue('');
  await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
  expect(router.replace).toHaveBeenCalledWith('/');
});

it('cerrar la recuperación de contraseña vuelve a la puerta de acceso', async () => {
  await renderRoute(<ResetPasswordRoute />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Cerrar' }));
  expect(router.replace).toHaveBeenCalledWith('/');
});

it.each([UnblockScreen, ResetPasswordRoute])(
  'sin backend de cuentas devuelve la ruta a la entrada',
  async (Route) => {
    mockAvailable = false;
    await renderRoute(<Route />);
    expect(router.redirects).toEqual(['/']);
  }
);
