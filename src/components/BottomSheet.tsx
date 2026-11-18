import { BlurTargetView, BlurView } from 'expo-blur';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type ScrollViewInstance,
  type ViewInstance,
  type ViewProps,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  SlideInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import {
  BlurIntensity,
  Control,
  Curves,
  Duration,
  MaxContentWidth,
  Radii,
  Spacing,
} from '@/constants/theme';
import { useReduceMotionSetting } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { glassStyle } from './glass';
import { Icon } from './icon';
import { ThemedText } from './themed-text';

type SurfaceRef = RefObject<ViewInstance | null>;
const BackdropTarget = createContext<SurfaceRef | undefined>(undefined);
/** Measured in window coordinates for a handoff from the sheet to its originating screen. */
export const BottomSheetFrame = createContext<SurfaceRef | null>(null);

/**
 * Movimiento que otro componente aplica al panel (p. ej. el vuelo hasta una
 * tarjeta al guardar). Lo compone el propio estilo animado de la hoja: un
 * `setNativeProps` desde fuera lo pisaba el siguiente commit de React en Fabric.
 */
export type SheetMotionStyle = {
  opacity: number;
  transform: (
    { translateX: number } | { translateY: number } | { scaleX: number } | { scaleY: number }
  )[];
};
export const BottomSheetMotion = createContext<SharedValue<SheetMotionStyle | null> | null>(null);

/** Wrap the presenting content so expo-blur can sample it on Android. */
export function BottomSheetBackground({ children, ...props }: ViewProps) {
  const target = useRef<ViewInstance>(null);
  return (
    <BackdropTarget.Provider value={target}>
      <BlurTargetView {...props} ref={target}>
        {children}
      </BlurTargetView>
    </BackdropTarget.Provider>
  );
}

type SnapPoint = number | `${number}%`;
const defaultPoints = [0.68];
const timing = { duration: Duration.base, easing: Easing.bezier(...Curves.out) };

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Fractions of the window (0–1), percentages, or absolute heights in dp. First = opening height. */
  snapPoints?: readonly SnapPoint[];
  children: ReactNode;
  footer?: ReactNode;
};

export function BottomSheet({ visible, ...props }: Props) {
  // El valor que Reanimated leyó al arrancar la app sirve solo hasta que el
  // sistema responde; desde ahí manda el ajuste en vivo, también si se apaga.
  const initiallyReduced = useReducedMotion();
  const liveReduced = useReduceMotionSetting();
  const reduced = liveReduced ?? initiallyReduced;
  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      presentationStyle="overFullScreen"
      animationType={reduced ? 'fade' : 'none'}
      onRequestClose={props.onClose}>
      {visible ? <SheetContents {...props} reduced={reduced} /> : null}
    </Modal>
  );
}

function SheetContents({
  onClose,
  title,
  children,
  footer,
  snapPoints = defaultPoints,
  reduced,
}: Omit<Props, 'visible'> & { reduced: boolean }) {
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const blurTarget = useContext(BackdropTarget);
  const frame = useRef<ViewInstance>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const [layoutHeight, setLayoutHeight] = useState(0);
  const [keyboard, setKeyboard] = useState(() => Keyboard.metrics?.());
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow',
      (e) => setKeyboard(e.endCoordinates)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboard(undefined)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // A resized Android modal has already lost the IME height. Only reserve the remaining overlap.
  const screenHeight = layoutHeight || windowHeight;
  const keyboardTop = keyboard?.screenY;
  const fullHeight = keyboard
    ? Math.max(screenHeight, keyboard.screenY + keyboard.height)
    : screenHeight;
  const overlap = Math.max(0, screenHeight - (keyboardTop ?? screenHeight));
  const available = Math.max(0, screenHeight - overlap - insets.top - Spacing.two);
  const points = (snapPoints.length ? snapPoints : defaultPoints).map((point) => {
    const dp =
      typeof point === 'string'
        ? (parseFloat(point) * fullHeight) / 100
        : point <= 1
          ? point * fullHeight
          : point;
    return Math.min(available, Math.max(Control.button, dp));
  });
  const initial = points[0];
  const height = useSharedValue(initial);
  const start = useSharedValue(initial);
  useEffect(() => {
    height.set(reduced ? initial : withTiming(initial, timing));
  }, [height, initial, reduced]);
  const motion = useSharedValue<SheetMotionStyle | null>(null);
  const panelStyle = useAnimatedStyle(() => ({
    height: Math.min(available, height.get()),
    ...(motion.get() ?? { opacity: 1, transform: [] }),
  }));

  const pan = Gesture.Pan()
    .withTestId('bottom-sheet-pan')
    .activeOffsetY([-5, 5])
    .onStart(() => {
      start.set(height.get());
    })
    .onUpdate((e) => {
      if (!reduced)
        height.set(
          Math.max(Control.button, Math.min(Math.max(...points), start.get() - e.translationY))
        );
    })
    .onEnd((e, success) => {
      if (!success) {
        height.set(reduced ? start.get() : withTiming(start.get(), timing));
        return;
      }
      const intended = start.get() - e.translationY - e.velocityY * 0.12;
      const lowest = Math.min(...points);
      const dismiss = intended < lowest - Math.min(72, lowest * 0.2);
      const next = dismiss
        ? start.get()
        : points.reduce((best, p) =>
            Math.abs(intended - p) < Math.abs(intended - best) ? p : best
          );
      height.set(reduced ? next : withTiming(next, timing));
      if (dismiss) scheduleOnRN(onClose);
    });

  function revealFocusedInput() {
    if (keyboardTop === undefined || Platform.OS === 'web') return;
    const viewport = scroll.current?.getNativeScrollRef();
    const focused = TextInput.State.currentlyFocusedInput();
    if (focused && viewport?.contains(focused)) {
      const field = focused.getBoundingClientRect();
      const bounds = viewport.getBoundingClientRect();
      const overlap = field.bottom + Spacing.two - bounds.bottom;
      if (overlap > 0) viewport.scrollTo({ y: viewport.scrollTop + overlap, animated: !reduced });
    }
  }

  return (
    <GestureHandlerRootView
      style={styles.root}
      onLayout={(e) => setLayoutHeight(e.nativeEvent.layout.height)}>
      <Animated.View
        style={StyleSheet.absoluteFill}
        entering={reduced ? undefined : FadeIn.duration(Duration.base)}>
        <BlurView
          tint="dark"
          intensity={BlurIntensity.sheet}
          blurTarget={blurTarget}
          blurMethod={Platform.OS === 'android' && blurTarget ? 'dimezisBlurView' : undefined}
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.background + '85' }]}
        />
      </Animated.View>
      <Animated.View
        ref={frame}
        collapsable={false}
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
        testID="bottom-sheet-panel"
        entering={
          reduced
            ? undefined
            : SlideInDown.duration(Duration.base)
                .easing(timing.easing)
                .reduceMotion(ReduceMotion.System)
        }
        style={[
          glassStyle(theme, { radius: Radii.sheet }),
          styles.sheet,
          {
            backgroundColor: theme.surfaceOpaque,
            marginBottom: overlap,
            paddingBottom: keyboardTop === undefined ? insets.bottom : 0,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
          panelStyle,
        ]}>
        <BottomSheetFrame.Provider value={frame}>
          <BottomSheetMotion.Provider value={motion}>
            <GestureDetector gesture={pan}>
              <View collapsable={false} style={styles.chrome}>
                <View style={[styles.handle, { backgroundColor: theme.textMuted }]} />
                <View style={styles.header}>
                  {title ? (
                    <ThemedText type="subtitle" accessibilityRole="header" style={styles.title}>
                      {title}
                    </ThemedText>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('Cerrar')}
                    onPress={onClose}
                    style={({ pressed }) => [
                      styles.close,
                      {
                        backgroundColor: pressed
                          ? theme.backgroundSelected
                          : theme.backgroundElement,
                      },
                    ]}>
                    <Icon name="close" color={theme.text} size={18} />
                  </Pressable>
                </View>
              </View>
            </GestureDetector>
            <ScrollView
              ref={scroll}
              onLayout={revealFocusedInput}
              style={styles.body}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.content}>
              {children}
            </ScrollView>
            {footer ? (
              <View style={[styles.footer, { borderColor: theme.border }]}>{footer}</View>
            ) : null}
          </BottomSheetMotion.Provider>
        </BottomSheetFrame.Provider>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

export default BottomSheet;

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
  },
  chrome: { paddingTop: Spacing.two, paddingHorizontal: Spacing.four },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: Radii.pill },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  title: { flex: 1 },
  close: {
    minWidth: Control.minTouch,
    minHeight: Control.minTouch,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.four, flexGrow: 1 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
});
