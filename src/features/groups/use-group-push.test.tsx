/**
 * `useGroupPush`: pregunta una vez por arranque y siempre pasa cómo dar de baja
 * el token si el permiso ya no está concedido.
 */

import { renderHook } from '@testing-library/react-native';

import { registerForPush } from '@/lib/push';

import { resetGroupPushForTests, useGroupPush } from './use-group-push';

jest.mock('@/lib/push', () => ({ registerForPush: jest.fn(() => Promise.resolve('denied')) }));

const mockRepositories = {
  push: { register: jest.fn(), unregister: jest.fn(() => Promise.resolve()) },
};
jest.mock('@/data', () => ({ useRepositories: () => mockRepositories }));

const register = registerForPush as jest.MockedFunction<typeof registerForPush>;

beforeEach(() => {
  jest.clearAllMocks();
  resetGroupPushForTests();
});

it('sin grupo no hace nada', async () => {
  await renderHook(() => useGroupPush(false));
  expect(register).not.toHaveBeenCalled();
});

it('al entrar pregunta una vez y, sin permiso, la baja va al repositorio', async () => {
  await renderHook(() => useGroupPush(true));
  expect(register).toHaveBeenLastCalledWith(expect.any(Function), {
    prompt: true,
    remove: expect.any(Function),
  });

  const { remove } = register.mock.calls[0][1];
  await remove?.('ExponentPushToken[x]');
  expect(mockRepositories.push.unregister).toHaveBeenCalledWith('ExponentPushToken[x]');
});

it('un segundo grupo en el mismo arranque ya no pregunta', async () => {
  const first = await renderHook(() => useGroupPush(true));
  await first.unmount();
  await renderHook(() => useGroupPush(true));
  expect(register).toHaveBeenLastCalledWith(expect.any(Function), {
    prompt: false,
    remove: expect.any(Function),
  });
});
