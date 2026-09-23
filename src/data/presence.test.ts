/** Mecánica exclusiva del adaptador en memoria; comportamiento común en el contrato. */
import { createMemoryPresenceAdapter } from './presence';

it('publica en el proceso antes de que join vuelva y aísla instancias', () => {
  const first = createMemoryPresenceAdapter();
  const second = createMemoryPresenceAdapter();
  const a = { onPeers: jest.fn(), onConnection: jest.fn() };
  const b = { onPeers: jest.fn(), onConnection: jest.fn() };
  const leave = first.join('s1', 'ana', a);
  second.join('s1', 'bea', b);
  expect(a.onPeers).toHaveBeenLastCalledWith(['ana']);
  expect(a.onConnection).toHaveBeenLastCalledWith(true);
  expect(b.onPeers).toHaveBeenLastCalledWith(['bea']);
  leave();
  expect(b.onPeers).toHaveBeenCalledTimes(1);
});
