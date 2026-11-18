import { render, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Text, View } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { Duration } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { ProjectHandoff } from './project-handoff';

jest.mock('@/hooks/use-reduce-motion', () => ({ useReduceMotion: jest.fn() }));

const source = { x: 0, y: 240, width: 390, height: 560 };
const measure = jest.fn();
beforeEach(() => {
  // El View de Jest solo implementa las medidas asíncronas de RN.
  View.prototype.getBoundingClientRect = measure.mockReturnValue({
    x: 24,
    y: 160,
    width: 342,
    height: 180,
  });
  jest.mocked(useReduceMotion).mockReturnValue(false);
  jest.spyOn(Haptics, 'impactAsync').mockResolvedValue();
  jest.spyOn(Haptics, 'performAndroidHapticsAsync').mockResolvedValue();
  jest.spyOn(Reanimated, 'withTiming');
});
afterEach(() => {
  delete View.prototype.getBoundingClientRect;
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

it.each([
  { reduced: false, measured: true, duration: Duration.slow },
  { reduced: true, measured: true, duration: Duration.fast },
  { reduced: false, measured: false, duration: Duration.fast },
])(
  'aterriza una vez con reducir movimiento=$reduced y medida disponible=$measured',
  async ({ reduced, measured, duration }) => {
    if (!measured) measure.mockReturnValue({ x: 0, y: 0, width: 0, height: 0 });
    jest.mocked(useReduceMotion).mockReturnValue(reduced);
    const onLand = jest.fn();
    const card = (
      <ProjectHandoff source={source} onLand={onLand}>
        <Text>Mapa</Text>
      </ProjectHandoff>
    );
    const view = await render(card);
    await waitFor(() => expect(onLand).toHaveBeenCalledTimes(1));
    expect(Reanimated.withTiming).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        duration,
        reduceMotion:
          duration === Duration.fast
            ? Reanimated.ReduceMotion.Never
            : Reanimated.ReduceMotion.System,
      }),
      expect.any(Function)
    );
    expect(measure.mock.calls.length > 0).toBe(!reduced);
    expect(screen.getByText('Mapa')).toBeTruthy();
    await view.rerender(card);
    const impacts =
      jest.mocked(Haptics.impactAsync).mock.calls.length +
      jest.mocked(Haptics.performAndroidHapticsAsync).mock.calls.length;
    expect(impacts).toBe(1);
  }
);
