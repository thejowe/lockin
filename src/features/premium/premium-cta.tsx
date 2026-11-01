/**
 * El botón grande de «Hazte Premium» en Ajustes.
 *
 * «Hazte Premium» arriba, centrado, y debajo un diamante grande. Al pulsarlo el
 * diamante crece desde el botón hasta cubrir la pantalla y, ya tapada, se
 * abre el paywall (con los dos planes, mensual y anual) por debajo; después el
 * diamante se desvanece y deja ver el paywall.
 *
 * `openPaywall` se llama nada más pulsar y no al final de la animación (aunque
 * el paywall no se vea hasta que el diamante se retira): se monta mientras crece, y así la transición nunca espera
 * a nada. Con «reducir movimiento» no hay diamante que crezca: solo se abre.
 */

import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Opacity, Radii, Spacing, Stroke } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

import { openPaywall } from './open-paywall';

const GEM = 72;
/** Cuántas veces crece el diamante: de sobra para tapar cualquier pantalla desde cualquier punto. */
const COVER_SCALE = 60;
const GROW_MS = 520;
const FADE_MS = 260;

export function PremiumCta() {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const gemRef = useRef<ViewInstance>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const overlayGem = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }],
  }));

  function finish() {
    setOrigin(null);
    scale.set(1);
    opacity.set(1);
  }

  function handlePress() {
    openPaywall();
    if (reduceMotion || !gemRef.current) return;
    gemRef.current.measureInWindow((x, y, width, height) => {
      scale.set(1);
      opacity.set(1);
      setOrigin({ x: x + width / 2, y: y + height / 2 });
      scale.set(
        withTiming(COVER_SCALE, { duration: GROW_MS, easing: Easing.in(Easing.cubic) }, (done) => {
          if (done) opacity.set(withTiming(0, { duration: FADE_MS }, () => runOnJS(finish)()));
        })
      );
    });
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hazte Premium"
        onPress={handlePress}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: theme.brassSoft,
            borderColor: theme.brass,
            opacity: pressed ? Opacity.pressed : 1,
          },
        ]}>
        <ThemedText type="subtitle" style={styles.title}>
          Hazte Premium
        </ThemedText>
        <View ref={gemRef} collapsable={false}>
          <Icon name="diamond" size={GEM} color={theme.brass} strokeWidth={1.4} />
        </View>
      </Pressable>

      <Modal transparent statusBarTranslucent animationType="none" visible={origin !== null}>
        {origin ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Animated.View
              style={[
                styles.gem,
                { left: origin.x - GEM / 2, top: origin.y - GEM / 2 },
                overlayGem,
              ]}>
              <Icon name="diamond" size={GEM} color={theme.brass} fill={theme.brass} />
            </Animated.View>
          </View>
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.card,
    borderWidth: Stroke.thin,
  },
  title: {
    textAlign: 'center',
  },
  gem: {
    position: 'absolute',
    width: GEM,
    height: GEM,
  },
});
