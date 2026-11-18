import { act, createRef, useImperativeHandle, type Ref } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, View, type ViewInstance, type ViewStyle } from 'react-native';
import Animated, { ReduceMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Duration, Opacity, PressScale } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { PinDrop } from './PinDrop';
import { CreateProjectShift, DetailsChevron, SlotPressable } from './ProfileMotion';
import { ProjectSheetSource, useProjectSaveMotion, useProjectSheet } from './ShrinkToSlot';
import { useArrivals } from './useArrivals';

jest.mock('@/hooks/use-reduce-motion', () => ({ useReduceMotion: jest.fn() }));
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  AndroidHaptics: { Segment_Tick: 'segment-tick', Virtual_Key: 'virtual-key' },
  impactAsync: jest.fn(async () => {}),
  performAndroidHapticsAsync: jest.fn(async () => {}),
}));

// Hold the completion callbacks until the test advances to contact. The stock
// Reanimated mock completes both halves of a sequence during its construction.
type End = (finished: boolean) => void;
const mockTiming = jest.fn(
  (to: number, config: { duration: number; reduceMotion?: ReduceMotion }, end?: End) => to
);
const mockSpring = jest.fn((to: number) => to);
const mockNative = jest.fn();
const mockStyles: (() => ViewStyle)[] = [];
const mockValues: { get: () => number; set: (v: number) => void }[] = [];
let mockPaint: () => void;
jest.mock('react-native-reanimated', () => {
  const base = jest.requireActual('react-native-reanimated/mock');
  const React = jest.requireActual('react');
  return {
    ...base,
    useSharedValue: (initial: unknown) => {
      const [v] = React.useState(() => base.useSharedValue(initial));
      mockValues.push(v);
      return v;
    },
    useAnimatedRef: () =>
      React.useMemo(() => {
        const ref = Object.assign(
          (node: ViewInstance) => {
            ref.current = node;
          },
          { current: null as ViewInstance | null }
        );
        return ref;
      }, []),
    useAnimatedReaction: (read: () => unknown, draw: (v: unknown) => void) => {
      mockPaint = () => draw(read());
    },
    useAnimatedStyle: (read: () => ViewStyle) => {
      mockStyles.push(read);
      return read();
    },
    setNativeProps: (...args: unknown[]) => mockNative(...args),
    withTiming: (...args: Parameters<typeof mockTiming>) => mockTiming(...args),
    withSpring: (to: number) => mockSpring(to),
    withSequence: (...steps: number[]) => steps[steps.length - 1],
  };
});
jest.mock('react-native-worklets', () => ({
  ...jest.requireActual('react-native-worklets/src/mock'),
  scheduleOnRN: (f: () => void) => f(),
  scheduleOnUI: (f: () => void) => f(),
}));

const initialPlatform = Platform.OS;
beforeEach(() => {
  jest.clearAllMocks();
  mockStyles.length = 0;
  mockValues.length = 0;
  jest.mocked(useReduceMotion).mockReturnValue(false);
  Platform.OS = 'ios';
  jest.useFakeTimers();
});
afterEach(() => {
  Platform.OS = initialPlatform;
  jest.useRealTimers();
});

function host(x: number, y: number, width: number, height: number) {
  return {
    getBoundingClientRect: jest.fn(() => ({ x, y, width, height })),
  } as unknown as ViewInstance;
}

const sheet = host(0, 400, 400, 400);
const panel = { current: sheet };
function Footer() {
  useProjectSheet(panel);
  return null;
}

type ProjectMotion = ReturnType<typeof useProjectSaveMotion>;
function List({ api }: { api: Ref<ProjectMotion> }) {
  const motion = useProjectSaveMotion();
  useImperativeHandle(api, () => motion);
  return (
    <ProjectSheetSource value={motion.source}>
      <Footer />
      {motion.transition}
    </ProjectSheetSource>
  );
}

it.each([false, true])(
  'flies the live sheet or fades it, then resolves the save once (reduced=%s)',
  async (reduced) => {
    jest.mocked(useReduceMotion).mockReturnValue(reduced);
    const api = createRef<ProjectMotion>();
    const card = host(60, 200, 200, 100);
    const view = await render(<List api={api} />);
    const motion = api.current!;
    motion.slot.current = card;
    let done!: Promise<void>;
    await act(async () => {
      done = motion.onProjectSaved('p');
    });
    expect(motion.onProjectSaved('p')).toBe(done);
    await act(async () => {
      jest.advanceTimersByTime(20);
    });
    await view.rerender(<List api={api} />);
    expect(mockTiming).toHaveBeenCalledTimes(1);
    const [, config, land] = mockTiming.mock.calls[0];
    expect(config.duration).toBe(reduced ? Duration.fast : Duration.slow);
    if (reduced) {
      expect(config.reduceMotion).toBe(ReduceMotion.Never);
      expect(card.getBoundingClientRect).not.toHaveBeenCalled();
    }
    // At 50% the centre should be midway from (200,600) to (160,250).
    mockValues[1].set(0.5);
    mockPaint();
    const style = mockNative.mock.lastCall?.[1];
    expect(style).toEqual(
      reduced
        ? { opacity: 0.5, transform: [] }
        : {
            opacity: 1,
            transform: [
              { translateX: -20 },
              { translateY: -175 },
              { scaleX: 0.75 },
              { scaleY: 0.625 },
            ],
          }
    );
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    await act(async () => {
      land?.(false);
    });
    expect(api.current?.projectId).toBe('p');
    await act(async () => {
      land?.(true);
      land?.(true);
      await done;
    });
    expect(api.current?.landedId).toBe('p');
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    await act(async () => {
      await motion.onProjectSaved('p');
    });
    expect(mockTiming).toHaveBeenCalledTimes(1);
  }
);

it('fades when the destination cannot be measured and ignores completion after leaving', async () => {
  const api = createRef<ProjectMotion>();
  const view = await render(<List api={api} />);
  const motion = api.current!;
  let done!: Promise<void>;
  await act(async () => {
    done = motion.onProjectSaved('p');
  });
  await act(async () => {
    jest.advanceTimersByTime(20);
  });
  const [, config, land] = mockTiming.mock.calls[0];
  expect(config.duration).toBe(Duration.fast);
  await view.unmount();
  land?.(true);
  await done;
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
});

it.each([false, true])(
  'pins only the new photo, with a single impact on contact (reduced=%s)',
  async (reduced) => {
    jest.mocked(useReduceMotion).mockReturnValue(reduced);
    Platform.OS = reduced ? 'android' : 'ios';
    const api = createRef<ReturnType<typeof useArrivals>>();
    function Grid() {
      const events = useArrivals();
      useImperativeHandle(api, () => events);
      return (
        <PinDrop id="photo" arrivals={events}>
          {(pin) => <Animated.View style={pin} />}
        </PinDrop>
      );
    }
    const view = await render(<Grid />);
    const events = api.current!;
    expect(mockTiming).not.toHaveBeenCalled();
    await act(async () => {
      events.start('photo');
      events.start('photo');
    });
    await view.rerender(<Grid />);
    const [photo, pin] = mockStyles.slice(-2);
    const progress = mockValues[0];
    progress.set(reduced ? 1 : 0);
    if (reduced) {
      expect(mockTiming).toHaveBeenCalledTimes(1);
      expect(mockTiming.mock.calls[0][1]).toMatchObject({ reduceMotion: ReduceMotion.Never });
      expect(photo()).toEqual({ opacity: 0.5, transform: [] });
      expect(pin()).toEqual({ opacity: 1, transform: [] });
    } else {
      expect(mockTiming.mock.calls.map(([to]) => to)).toEqual([1, 2]);
      expect(photo().transform).toEqual([
        { translateY: -24 },
        { scale: 1.045 },
        { rotate: '2deg' },
      ]);
      expect(pin().opacity).toBe(0);
      progress.set(0.8);
      expect(photo().transform).toEqual(
        expect.arrayContaining([{ translateY: expect.closeTo(2) }])
      );
      progress.set(1);
      expect(pin().opacity).toBe(0);
      progress.set(1.5);
      expect(pin().opacity).toBe(1);
    }
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
    const land = mockTiming.mock.lastCall?.[2];
    await act(async () => {
      land?.(true);
      land?.(true);
    });
    expect(api.current?.pending.size).toBe(0);
    const impact = reduced ? Haptics.performAndroidHapticsAsync : Haptics.impactAsync;
    expect(impact).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledWith(
      reduced ? Haptics.AndroidHaptics.Virtual_Key : Haptics.ImpactFeedbackStyle.Medium
    );
    const count = mockTiming.mock.calls.length;
    await act(async () => {
      events.start('photo');
    });
    expect(mockTiming).toHaveBeenCalledTimes(count);
  }
);

it('does not restart a photo drop or vibrate late when the board recycles its cell', async () => {
  const api = createRef<ReturnType<typeof useArrivals>>();
  function Grid({ revision }: { revision: number }) {
    const arrivals = useArrivals();
    useImperativeHandle(api, () => arrivals);
    return (
      <PinDrop key={revision} id="p" arrivals={arrivals}>
        {(pin) => <Animated.View style={pin} />}
      </PinDrop>
    );
  }
  const view = await render(<Grid revision={0} />);
  await act(async () => {
    api.current?.start('p');
  });
  const oldEnd = mockTiming.mock.lastCall?.[2];
  await view.rerender(<Grid revision={1} />);
  oldEnd?.(true);
  expect(mockTiming).toHaveBeenCalledTimes(2);
  expect(api.current?.pending.size).toBe(0);
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
});

it.each([false, true])(
  'presses and releases the existing control (reduced=%s)',
  async (reduced) => {
    jest.mocked(useReduceMotion).mockReturnValue(reduced);
    const onPress = jest.fn();
    await render(
      <SlotPressable
        testID="slot"
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => ({ flex: pressed ? 1 : 2 })}>
        <View />
      </SlotPressable>
    );
    const slot = screen.getByTestId('slot');
    await fireEvent(slot, 'pressIn');
    expect(mockStyles.at(-1)?.()).toEqual(
      reduced ? { opacity: Opacity.pressed, transform: [] } : { transform: [{ scale: PressScale }] }
    );
    await fireEvent.press(slot);
    await fireEvent(slot, 'pressOut');
    expect(onPress).toHaveBeenCalledTimes(1);
    expect((reduced ? mockTiming : mockSpring).mock.calls.map(([to]) => to)).toEqual([1, 0]);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  }
);

it.each([false, true])(
  'animates each insertion and each disclosure change once (reduced=%s)',
  async (reduced) => {
    jest.mocked(useReduceMotion).mockReturnValue(reduced);
    function Row({ id, expanded = false }: { id?: string; expanded?: boolean }) {
      return (
        <>
          <CreateProjectShift id={id}>
            <View />
          </CreateProjectShift>
          <DetailsChevron expanded={expanded}>
            <View />
          </DetailsChevron>
        </>
      );
    }
    const view = await render(<Row />);
    expect(mockTiming).not.toHaveBeenCalled();
    await view.rerender(<Row id="p" expanded />);
    await view.rerender(<Row id="p" expanded />);
    expect(mockTiming).toHaveBeenCalledTimes(2);
    if (reduced) {
      expect(
        mockTiming.mock.calls.every(([, cfg]) => cfg.reduceMotion === ReduceMotion.Never)
      ).toBe(true);
      mockValues[0].set(0.5);
      expect(mockStyles.at(-2)?.()).toEqual({
        opacity: Opacity.pressed + (1 - Opacity.pressed) / 2,
        transform: [],
      });
    }
    await view.rerender(<Row id="p" />);
    expect(mockTiming.mock.lastCall?.[0]).toBe(reduced ? 1 : -90);
    await view.rerender(<Row key="remounted" id="p" />);
    expect(mockTiming).toHaveBeenCalledTimes(3);
  }
);
