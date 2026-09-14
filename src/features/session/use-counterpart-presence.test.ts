/** Qué estado de presencia ve una persona de la otra. Ojo: en RNTL 14 `renderHook` es asíncrono. */

import { act, renderHook } from '@testing-library/react-native';

import { createMemoryPresenceAdapter } from '@/data';

import { useCounterpartPresence } from './use-counterpart-presence';

import type { PresenceAdapter, PresenceHandlers } from '@/data';

describe('useCounterpartPresence', () => {
  it('pasa de ausente a aquí cuando la otra persona entra, y vuelve al salir', async () => {
    const adapter = createMemoryPresenceAdapter();
    const { result } = await renderHook(() => useCounterpartPresence('s1', 'me', 'nuria', adapter));
    expect(result.current).toBe('ausente');

    let leave: () => void = () => {};
    await act(async () => {
      leave = adapter.join('s1', 'nuria', { onPeers: () => {}, onConnection: () => {} });
    });
    expect(result.current).toBe('aqui');

    await act(async () => leave());
    expect(result.current).toBe('ausente');
  });

  it('sin conexión propia no afirma nada de la otra persona', async () => {
    let handlers: PresenceHandlers | null = null;
    const adapter: PresenceAdapter = {
      join: (_session, _profile, received) => {
        handlers = received;
        return () => {};
      },
    };
    const { result } = await renderHook(() => useCounterpartPresence('s1', 'me', 'nuria', adapter));

    await act(async () => {
      handlers!.onPeers(['me', 'nuria']);
      handlers!.onConnection(false);
    });

    expect(result.current).toBe('sin-conexion');
  });

  it('sin sesión o sin perfil propio no se une a ninguna sala', async () => {
    const adapter: PresenceAdapter = { join: jest.fn(() => () => {}) };

    await renderHook(() => useCounterpartPresence(null, 'me', 'nuria', adapter));
    await renderHook(() => useCounterpartPresence('s1', null, 'nuria', adapter));

    expect(adapter.join).not.toHaveBeenCalled();
  });
});
