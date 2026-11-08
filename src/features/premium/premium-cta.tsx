/**
 * El botón grande de «Hazte Premium» en Ajustes.
 *
 * Un diamante azul grande arriba y «Hazte Premium» debajo. Al pulsarlo, el
 * diamante crece desde donde está hasta cubrir toda la pantalla; ya tapada, se
 * abre el paywall (con los dos planes, mensual y anual) por debajo, se espera a
 * que termine de subir y el diamante se desvanece para dejar ver los planes.
 *
 * Con «reducir movimiento» no hay diamante que crezca: se abre el paywall sin
 * más.
 */

import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Control, Opacity, Radii, Spacing, Stroke } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

import { openPaywall } from './open-paywall';
import { t } from '@/i18n';

const GEM = 72;
/** El diamante del perfil: crece con el mismo `COVER_SCALE`, así que el gesto es idéntico. */
const GEM_SMALL = 30;
/** Cuántas veces crece el diamante: de sobra para tapar cualquier pantalla desde cualquier punto. */
const COVER_SCALE = 60;
const GROW_MS = 650;
/** Lo que tarda la hoja del paywall en subir bajo el diamante, antes de retirarlo. */
const HOLD_MS = 450;
const FADE_MS = 300;

/**
 * La animación del diamante que crece hasta tapar la pantalla y abre el paywall.
 * La comparten el botón grande de Ajustes y el diamante pequeño del perfil.
 */
function useGemTakeover(size: number) {
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

  /** Con la pantalla ya tapada: abre el paywall, espera a que suba y retira el diamante. */
  function covered() {
    openPaywall();
    opacity.set(
      withDelay(
        HOLD_MS,
        withTiming(0, { duration: FADE_MS }, () => runOnJS(finish)())
      )
    );
  }

  function handlePress() {
    if (reduceMotion || !gemRef.current) {
      openPaywall();
      return;
    }
    gemRef.current.measureInWindow((x, y, width, height) => {
      scale.set(1);
      opacity.set(1);
      setOrigin({ x: x + width / 2, y: y + height / 2 });
      scale.set(
        withTiming(COVER_SCALE, { duration: GROW_MS, easing: Easing.in(Easing.cubic) }, (done) => {
          if (done) runOnJS(covered)();
        })
      );
    });
  }

  const overlay = (
    <Modal transparent statusBarTranslucent animationType="none" visible={origin !== null}>
      {origin ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Animated.View
            style={[
              styles.gem,
              {
                width: size,
                height: size,
                left: origin.x - size / 2,
                top: origin.y - size / 2,
              },
              overlayGem,
            ]}>
            <Icon name="diamond" size={size} color={theme.diamond} fill={theme.diamond} />
          </Animated.View>
        </View>
      ) : null}
    </Modal>
  );

  return { gemRef, handlePress, overlay };
}

export function PremiumCta() {
  const theme = useTheme();
  const { gemRef, handlePress, overlay } = useGemTakeover(GEM);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Hazte Premium')}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: theme.brassSoft,
            borderColor: theme.diamond,
            opacity: pressed ? Opacity.pressed : 1,
          },
        ]}>
        <View ref={gemRef} collapsable={false}>
          <Icon name="diamond" size={GEM} color={theme.diamond} strokeWidth={1.4} />
        </View>
        <ThemedText type="subtitle" style={styles.title}>
          {t('Hazte Premium')}
        </ThemedText>
      </Pressable>
      {overlay}
    </>
  );
}

/**
 * El diamante pequeño del perfil: mismo gesto que «Hazte Premium» de Ajustes
 * (el diamante crece, tapa la pantalla y se abren los planes), sin entrar al menú.
 */
export function PremiumGemButton() {
  const theme = useTheme();
  const { gemRef, handlePress, overlay } = useGemTakeover(GEM_SMALL);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Hazte Premium')}
        onPress={handlePress}
        style={({ pressed }) => [styles.gemButton, { opacity: pressed ? Opacity.pressed : 1 }]}>
        <View ref={gemRef} collapsable={false}>
          <Icon name="diamond" size={GEM_SMALL} color={theme.diamond} strokeWidth={1.6} />
        </View>
      </Pressable>
      {overlay}
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
  gemButton: {
    width: Control.minTouch,
    height: Control.minTouch,
    marginRight: -Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gem: {
    position: 'absolute',
  },
});
