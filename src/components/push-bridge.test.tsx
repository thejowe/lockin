/**
 * `PushBridge`: al montar y al volver a primer plano comprueba el permiso de
 * avisos y, si se retiró, da de baja el token con el repositorio.
 */

import { render } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { forgetPushTokenIfDenied } from '@/lib/push';

import { PushBridge } from './push-bridge';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/push', () => ({
  installPushHandlers: jest.fn(() => () => undefined),
  forgetPushTokenIfDenied: jest.fn(() => Promise.resolve()),
}));

const mockRepositories = {
  push: { register: jest.fn(), unregister: jest.fn(() => Promise.resolve()) },
};
jest.mock('@/data', () => ({ useRepositories: () => mockRepositories }));

const forgetIfDenied = forgetPushTokenIfDenied as jest.MockedFunction<
  typeof forgetPushTokenIfDenied
>;

it('comprueba al montar y al volver a primer plano, no al irse', async () => {
  let listener: ((state: AppStateStatus) => void) | undefined;
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    listener = handler as (state: AppStateStatus) => void;
    return { remove } as never;
  });

  const view = await render(<PushBridge />);
  expect(forgetIfDenied).toHaveBeenCalledTimes(1);

  listener?.('background');
  expect(forgetIfDenied).toHaveBeenCalledTimes(1);
  listener?.('active');
  expect(forgetIfDenied).toHaveBeenCalledTimes(2);

  await forgetIfDenied.mock.calls[0][0]('ExponentPushToken[x]');
  expect(mockRepositories.push.unregister).toHaveBeenCalledWith('ExponentPushToken[x]');

  await view.unmount();
  expect(remove).toHaveBeenCalled();
});
