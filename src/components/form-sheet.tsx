import { useRef, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloseHeader } from './close-button';
import { Frosted } from './glass';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

export function FormSheet({
  header,
  onClose,
  disabled = false,
  children,
  footer,
  testID,
  ownScroll = false,
}: {
  header: ReactNode;
  onClose: () => void;
  disabled?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  testID?: string;
  ownScroll?: boolean;
}) {
  const theme = useTheme();
  const reduced = useReduceMotion();
  const insets = useSafeAreaInsets();
  const drag = useRef<{ x: number; y: number; time: number } | null>(null);
  function finishDrag({ nativeEvent }: GestureResponderEvent) {
    const start = drag.current;
    drag.current = null;
    if (!start || disabled) return;
    const dy = nativeEvent.pageY - start.y;
    const dx = nativeEvent.pageX - start.x;
    const elapsed = Math.max(1, nativeEvent.timestamp - start.time);
    if (dy > Math.abs(dx) && (dy > 45 || (dy > 15 && dy / elapsed > 0.6))) onClose();
  }
  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType={reduced ? 'none' : 'slide'}
      testID={testID}
      onRequestClose={() => {
        if (!disabled) onClose();
      }}>
      <KeyboardAvoidingView
        behavior="padding"
        style={[
          styles.backdrop,
          {
            paddingTop: insets.top + Spacing.two,
            paddingLeft: insets.left,
            paddingRight: insets.right,
            backgroundColor: theme.background + '99',
          },
        ]}>
        <Pressable
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          disabled={disabled}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <Frosted
          radius={Radii.sheet}
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: theme.surfaceOpaque }]}>
          <View style={{ flexShrink: 1, paddingBottom: Math.max(Spacing.two, insets.bottom) }}>
            <View
              collapsable={false}
              style={styles.header}
              testID="sheet-drag-area"
              onStartShouldSetResponder={() => !disabled}
              onResponderGrant={({ nativeEvent }) => {
                drag.current = {
                  x: nativeEvent.pageX,
                  y: nativeEvent.pageY,
                  time: nativeEvent.timestamp,
                };
              }}
              onResponderRelease={finishDrag}
              onResponderTerminate={() => {
                drag.current = null;
              }}>
              <View
                pointerEvents="none"
                style={[styles.handle, { backgroundColor: theme.textMuted }]}
              />
              <CloseHeader onPress={onClose} disabled={disabled}>
                {header}
              </CloseHeader>
            </View>
            {ownScroll ? (
              children
            ) : (
              <ScrollView
                style={styles.scroll}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.content}>
                {children}
              </ScrollView>
            )}
            {footer && <View style={styles.footer}>{footer}</View>}
          </View>
        </Frosted>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '100%',
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexShrink: 1,
    overflow: 'hidden',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  handle: {
    alignSelf: 'center',
    height: 4,
    width: 36,
    borderRadius: Radii.pill,
    marginBottom: Spacing.one,
  },
  scroll: { flexShrink: 1, flexGrow: 0 },
  content: { gap: Spacing.three, paddingHorizontal: Spacing.four, paddingVertical: Spacing.two },
  footer: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.two },
});
