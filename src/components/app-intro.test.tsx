import { act, render } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { AppIntro } from './app-intro';
import { introHandoff } from './intro-handoff';

let mockReduce = false;
jest.mock('@/hooks/use-reduce-motion', () => ({ useReduceMotion: () => mockReduce }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

beforeEach(() => {
  jest.useFakeTimers();
  mockReduce = false;
  introHandoff.begin();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

it('espera una decisión tardía y entrega el control a la app una sola vez', async () => {
  const done = jest.fn();
  await render(<AppIntro onDone={done} />);
  await act(() => jest.advanceTimersByTime(1600));
  expect(done).not.toHaveBeenCalled();
  await act(() => introHandoff.setDestination('app'));
  await act(() => jest.advanceTimersByTime(1500));
  expect(done).toHaveBeenCalledTimes(1);
  expect(introHandoff.get().active).toBe(false);
});

it('si falta el destino, retira la cortina al vencer la espera', async () => {
  const done = jest.fn();
  await render(<AppIntro onDone={done} />);
  await act(() => jest.advanceTimersByTime(3000));
  expect(done).toHaveBeenCalledTimes(1);
});

it('al desmontarse durante la espera retira los temporizadores y la suscripción', async () => {
  const done = jest.fn();
  const view = await render(<AppIntro onDone={done} />);
  await act(() => jest.advanceTimersByTime(1600));
  await view.unmount();
  introHandoff.setDestination('app');
  await act(() => jest.advanceTimersByTime(3000));
  expect(done).not.toHaveBeenCalled();
});

it('con movimiento reducido evita la vibración y libera la bienvenida', async () => {
  mockReduce = true;
  const done = jest.fn();
  await render(<AppIntro onDone={done} />);
  await act(() => jest.advanceTimersByTime(2000));
  expect(done).toHaveBeenCalledTimes(1);
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
});
