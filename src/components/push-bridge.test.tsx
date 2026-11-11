/**
 * `PushBridge`: al montar y al volver a primer plano comprueba el permiso de
 * avisos y, si se retiró, da de baja el token con el repositorio.
 */

import { render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { act } from 'react';

import { forgetPushTokenIfDenied, registerForPush } from '@/lib/push';

import { PushBridge } from './push-bridge';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/matches',
}));
jest.mock('@/lib/push', () => ({
  installPushHandlers: jest.fn(() => () => undefined),
  forgetPushTokenIfDenied: jest.fn(() => Promise.resolve()),
  registerForPush: jest.fn(() => Promise.resolve('registered')),
  setActivePushRoute: jest.fn(),
  routeOf: (data: { url: string }) => data.url,
}));

const mockRepositories = {
  push: {
    register: jest.fn(),
    unregister: jest.fn(() => Promise.resolve()),
    currentAccountId: jest.fn(() => Promise.resolve('user')),
    setLocale: jest.fn(() => Promise.resolve()),
    touchLastActive: jest.fn(() => Promise.resolve()),
  },
};
jest.mock('@/data', () => ({ useRepositories: () => mockRepositories }));

const forgetIfDenied = forgetPushTokenIfDenied as jest.MockedFunction<
  typeof forgetPushTokenIfDenied
>;

beforeEach(() => {
  jest.clearAllMocks();
  mockRepositories.push.currentAccountId.mockResolvedValue('user');
});

it('comprueba al montar y al volver a primer plano, no al irse', async () => {
  let listener: ((state: AppStateStatus) => void) | undefined;
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    listener = handler as (state: AppStateStatus) => void;
    return { remove } as never;
  });

  const view = await render(<PushBridge />);
  await waitFor(() =>
    expect(registerForPush).toHaveBeenCalledWith(expect.any(Function), {
      prompt: false,
      remove: expect.any(Function),
    })
  );
  expect(mockRepositories.push.setLocale).toHaveBeenCalledWith('es');
  expect(mockRepositories.push.touchLastActive).toHaveBeenCalledTimes(1);
  expect(forgetIfDenied).toHaveBeenCalledTimes(1);

  listener?.('background');
  expect(forgetIfDenied).toHaveBeenCalledTimes(1);
  listener?.('active');
  expect(forgetIfDenied).toHaveBeenCalledTimes(2);
  await waitFor(() => expect(registerForPush).toHaveBeenCalledTimes(2));
  expect(mockRepositories.push.touchLastActive).toHaveBeenCalledTimes(1);

  await forgetIfDenied.mock.calls[0][0]('ExponentPushToken[x]');
  expect(mockRepositories.push.unregister).toHaveBeenCalledWith('ExponentPushToken[x]');

  await view.unmount();
  expect(remove).toHaveBeenCalled();
});

it('sin sesión no registra ni crea actividad; otro usuario tiene su propio throttle', async () => {
  let listener: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    listener = handler as typeof listener;
    return { remove: jest.fn() };
  });
  mockRepositories.push.currentAccountId.mockResolvedValueOnce(null as never);
  await render(<PushBridge />);
  await waitFor(() => expect(mockRepositories.push.currentAccountId).toHaveBeenCalled());
  expect(mockRepositories.push.setLocale).not.toHaveBeenCalled();
  expect(registerForPush).not.toHaveBeenCalled();
  await act(async () => {
    listener?.('active');
  });
  expect(mockRepositories.push.touchLastActive).toHaveBeenCalledTimes(1);
  mockRepositories.push.currentAccountId.mockResolvedValue('other-user');
  await act(async () => {
    listener?.('active');
  });
  expect(mockRepositories.push.touchLastActive).toHaveBeenCalledTimes(2);
});
