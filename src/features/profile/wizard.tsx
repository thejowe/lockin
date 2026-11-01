/**
 * El armazón de los formularios por pasos del alta (2026-11-01).
 *
 * Una pregunta por pantalla, con una barra de progreso arriba, la flecha de
 * volver a la izquierda y, si el paso es opcional, «Omitir» a la derecha. El
 * contenido y el botón van dentro del mismo scroll: así el teclado, que sube el
 * campo enfocado (`KeyboardAwareScrollView`), nunca tapa el botón de seguir.
 */

import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { BackArrow } from '@/components/back-arrow';
import { ThemedText } from '@/components/themed-text';
import {
  Control,
  Curves,
  Duration,
  MaxContentWidth,
  Opacity,
  Radii,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { PrimaryButton } from './controls';

const easeOut = Easing.bezier(...Curves.out);

/** Barra fina que se llena con el avance: `step` de `total`, contando desde 1. */
export function WizardProgress({ step, total }: { step: number; total: number }) {
  const theme = useTheme();
  const fraction = useSharedValue(step / total);

  useEffect(() => {
    fraction.set(withTiming(step / total, { duration: Duration.slow, easing: easeOut }));
  }, [step, total, fraction]);

  const fill = useAnimatedStyle(() => ({ width: `${fraction.get() * 100}%` }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Paso ${step} de ${total}`}
      accessibilityValue={{ min: 0, max: total, now: step }}
      style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
      <Animated.View style={[styles.fill, { backgroundColor: theme.brass }, fill]} />
    </View>
  );
}

export function WizardScreen({
  step,
  total,
  title,
  subtitle,
  onBack,
  onSkip,
  primaryLabel,
  onPrimary,
  busy = false,
  error,
  below,
  children,
}: {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  /** Sin él no hay flecha (primer paso de una pantalla que no puede volver). */
  onBack?: () => void;
  /** Solo en los pasos opcionales. */
  onSkip?: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  busy?: boolean;
  /** Fallo de guardado, bajo el botón. */
  error?: string | null;
  /** Lo que va bajo el botón principal (Google / Apple en el primer paso). */
  below?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        {onBack ? <BackArrow onPress={onBack} /> : <View style={styles.side} />}
        <View style={styles.progress}>
          <WizardProgress step={step} total={total} />
        </View>
        <View style={[styles.side, styles.sideEnd]}>
          {onSkip ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Omitir"
              hitSlop={8}
              onPress={onSkip}
              style={({ pressed }) => ({ opacity: pressed ? Opacity.pressed : 1 })}>
              <ThemedText type="bodyStrong" themeColor="textSecondary">
                Omitir
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={Spacing.five}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View style={styles.body}>
          <View style={styles.header}>
            <ThemedText type="title">{title}</ThemedText>
            {subtitle ? (
              <ThemedText type="body" themeColor="textSecondary">
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          {children}
        </View>

        <View style={styles.actions}>
          <PrimaryButton label={primaryLabel} disabled={busy} onPress={onPrimary} />
          {error ? (
            <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
              {error}
            </ThemedText>
          ) : null}
          {below}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingRight: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  side: {
    width: Control.minTouch + Spacing.two,
  },
  sideEnd: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    width: 64,
  },
  progress: {
    flex: 1,
  },
  track: {
    height: 4,
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: Radii.pill,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  body: {
    flexGrow: 1,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  actions: {
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
});
