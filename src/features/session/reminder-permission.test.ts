/** Si falla la lectura del descarte guardado, el aviso se trata como no descartado. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';

import { setReminderPermissionDenied, useReminderHint } from './reminder-permission';

afterEach(() => {
  setReminderPermissionDenied(false);
});

describe('useReminderHint', () => {
  it('si falla la lectura del descarte guardado, muestra el aviso igualmente', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('boom'));
    setReminderPermissionDenied(true);

    const { result } = await renderHook(() => useReminderHint());

    await waitFor(() => expect(result.current.visible).toBe(true));
  });
});
