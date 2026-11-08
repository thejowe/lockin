/**
 * La intro que se ve cada vez que se abre la app (arranque en frío).
 *
 * Una cortina negra —el mismo negro del splash nativo, para que no haya salto—
 * con el logo de cofounder:
 *
 *   1. el logo aparece de forma progresiva (fundido + un poco de escala);
 *   2. una luz tras él lo enfoca, entrando de izquierda a derecha hasta quedar
 *      detrás del símbolo, como un foco que lo ilumina a contraluz;
 *   3. la luz se reduce y el logo da un pequeño rebote;
 *   4. la cortina se funde y deja ver la app, que ya estaba montada debajo.
 *
 * Dura ~2 s. Con «reducir movimiento» el logo se muestra quieto un instante y
 * la cortina se funde, sin luz ni rebote.
 */

import { useCallback, useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { CofounderLogo } from '@/components/cofounder-logo';
import { Colors, Curves, Springs } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

/** Duraciones de cada tramo, en ms. La suma (con el fundido final) ronda los 2 s. */
const LOGO_IN_MS = 500;
const LIGHT_DELAY_MS = 350;
const LIGHT_SWEEP_MS = 850;
const SETTLE_DELAY_MS = LIGHT_DELAY_MS + LIGHT_SWEEP_MS;
const LIGHT_SHRINK_MS = 380;
const CURTAIN_DELAY_MS = SETTLE_DELAY_MS + 330;
const CURTAIN_MS = 340;
const REDUCED_HOLD_MS = 700;

const easeOut = Easing.bezier(...Curves.out);
const easeInOut = Easing.bezier(...Curves.inOut);

export function AppIntro({ onDone }: { onDone: () => void }) {
  const { width: screenWidth } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const logoWidth = Math.min(screenWidth * 0.5, 240);
  const glowSize = logoWidth * 2.4;

  const logo = useSharedValue(0); // aparición del logo
  const light = useSharedValue(0); // 0 = fuera por la izquierda, 1 = tras el logo
  const glow = useSharedValue(0); // intensidad y tamaño de la luz
  const bounce = useSharedValue(1); // escala del logo
  const curtain = useSharedValue(1); // opacidad de la cortina

  const finish = useCallback(() => onDone(), [onDone]);

  useEffect(() => {
    if (reduceMotion) {
      logo.value = withTiming(1, { duration: 200 });
      curtain.value = withDelay(
        REDUCED_HOLD_MS,
        withTiming(0, { duration: CURTAIN_MS }, (done) => {
          if (done) runOnJS(finish)();
        })
      );
      return;
    }

    logo.value = withTiming(1, { duration: LOGO_IN_MS, easing: easeOut });

    // La luz entra por la izquierda, crece hasta quedar tras el logo…
    light.value = withDelay(
      LIGHT_DELAY_MS,
      withTiming(1, { duration: LIGHT_SWEEP_MS, easing: easeInOut })
    );
    glow.value = withDelay(
      LIGHT_DELAY_MS,
      withSequence(
        withTiming(1, { duration: LIGHT_SWEEP_MS, easing: easeInOut }),
        // …y se reduce.
        withTiming(0.28, { duration: LIGHT_SHRINK_MS, easing: easeOut })
      )
    );

    // Al reducirse la luz, el logo rebota una vez.
    bounce.value = withDelay(
      SETTLE_DELAY_MS,
      withSequence(withTiming(1.1, { duration: 130, easing: easeOut }), withSpring(1, Springs.pop))
    );

    curtain.value = withDelay(
      CURTAIN_DELAY_MS,
      withTiming(0, { duration: CURTAIN_MS, easing: easeInOut }, (done) => {
        if (done) runOnJS(finish)();
      })
    );
  }, [reduceMotion, logo, light, glow, bounce, curtain, finish]);

  const curtainStyle = useAnimatedStyle(() => ({ opacity: curtain.value }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logo.value,
    transform: [{ scale: (0.94 + logo.value * 0.06) * bounce.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [
      // De fuera de pantalla por la izquierda hasta el centro, tras el logo.
      { translateX: -(1 - light.value) * screenWidth * 0.75 },
      { scale: 0.55 + glow.value * 0.7 },
    ],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.curtain, curtainStyle]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="cofounder">
      <Animated.View
        pointerEvents="none"
        style={[{ width: glowSize, height: glowSize }, styles.glow, glowStyle]}>
        <Svg width={glowSize} height={glowSize}>
          <Defs>
            <RadialGradient id="intro-glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.5} />
              <Stop offset="35%" stopColor="#FFFFFF" stopOpacity={0.2} />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={glowSize} height={glowSize} fill="url(#intro-glow)" />
        </Svg>
      </Animated.View>
      <View pointerEvents="none">
        <Animated.View style={logoStyle}>
          <CofounderLogo width={logoWidth} animated={false} color={Colors.dark.text} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  curtain: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  glow: {
    position: 'absolute',
  },
});
