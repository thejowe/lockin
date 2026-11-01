import { renderHook, waitFor } from '@testing-library/react-native';

import { useRegistrationGate } from './use-registration-gate';

const mockRead = jest.fn();

jest.mock('./account-gateway', () => ({
  registrationRequired: true,
  readAccountState: () => mockRead(),
}));

const base = { userId: 'u', email: 'a@b.c', pendingEmail: null };

describe('useRegistrationGate', () => {
  it('cuenta recuperable con móvil: open', async () => {
    mockRead.mockResolvedValue({ ...base, kind: 'email', recoverable: true, phone: '+34600123456' });
    const { result } = await renderHook(() => useRegistrationGate());
    await waitFor(() => expect(result.current).toBe('open'));
  });

  it('cuenta recuperable sin móvil (GitHub, Google…): phone', async () => {
    mockRead.mockResolvedValue({ ...base, kind: 'email', recoverable: true, phone: null });
    const { result } = await renderHook(() => useRegistrationGate());
    await waitFor(() => expect(result.current).toBe('phone'));
  });

  it('cuenta sin asegurar: required', async () => {
    mockRead.mockResolvedValue({ ...base, kind: 'anonymous', email: null, recoverable: false, phone: null });
    const { result } = await renderHook(() => useRegistrationGate());
    await waitFor(() => expect(result.current).toBe('required'));
  });
});
