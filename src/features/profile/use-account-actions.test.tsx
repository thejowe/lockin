import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAccountActions } from './use-account-actions';
import { saveAccountPhone, setAccountPassword, readAccountState } from './account-gateway';
import { type PropsWithChildren } from 'react';
import { DataProvider } from '@/data';
import { createMockRepositories, createMockStore } from '@/data/mock';

jest.mock('./account-gateway', () => ({
  ...jest.requireActual('./account-gateway'),
  readAccountState: jest.fn(),
  saveAccountPhone: jest.fn(),
  setAccountPassword: jest.fn(),
}));

it('valida los datos de contacto antes de guardarlos y permite retirarlos', async () => {
  jest.mocked(readAccountState).mockResolvedValue(null);
  const value = createMockRepositories(createMockStore());
  const wrapper = ({ children }: PropsWithChildren) => (
    <DataProvider value={value}>{children}</DataProvider>
  );
  const { result } = await renderHook(useAccountActions, { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(() => result.current.savePhone('nada'));
  expect(result.current.notice?.tone).toBe('danger');
  expect(saveAccountPhone).not.toHaveBeenCalled();
  await act(() => result.current.savePhone('+34 612 345 678'));
  expect(saveAccountPhone).toHaveBeenCalledWith('+34612345678');
  const done = jest.fn();
  await act(() => result.current.removePhone(done));
  expect(saveAccountPhone).toHaveBeenCalledWith('');
  expect(done).toHaveBeenCalled();
  await act(() => result.current.savePassword(''));
  expect(setAccountPassword).not.toHaveBeenCalled();
  expect(result.current.notice?.text).toMatch(/contraseña/);
  await act(() => result.current.savePassword('secreta-123'));
  expect(setAccountPassword).toHaveBeenCalledWith('secreta-123');
  await act(() => result.current.changePassword('', 'secreta-123'));
  expect(result.current.notice?.text).toMatch(/actual/);
});
