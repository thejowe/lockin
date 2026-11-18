import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** A native tick on Android avoids using the vibrator to emulate an iOS impact. */
export function arrivalImpact(kind: 'project' | 'pin') {
  const impact =
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(
          kind === 'project'
            ? Haptics.AndroidHaptics.Segment_Tick
            : Haptics.AndroidHaptics.Virtual_Key
        )
      : Haptics.impactAsync(
          kind === 'project'
            ? Haptics.ImpactFeedbackStyle.Light
            : Haptics.ImpactFeedbackStyle.Medium
        );
  void impact.catch(() => undefined);
}
