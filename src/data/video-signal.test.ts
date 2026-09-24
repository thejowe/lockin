/** Mecánica exclusiva del adaptador en memoria; comportamiento común en el contrato. */
import { createMemoryVideoSignalAdapter } from './video-signal';

it('entrega dentro del proceso antes de que send vuelva y aísla instancias', () => {
  const first = createMemoryVideoSignalAdapter();
  const second = createMemoryVideoSignalAdapter();
  const a = { onMessage: jest.fn(), onConnection: jest.fn() };
  const b = { onMessage: jest.fn(), onConnection: jest.fn() };
  first.join('s1', 'bea', a);
  second.join('s1', 'bea', b);
  const message = { kind: 'hangup' as const, from: 'ana', payload: null };
  first.send('s1', message);
  expect(a.onMessage).toHaveBeenCalledWith(message);
  expect(b.onMessage).not.toHaveBeenCalled();
});
