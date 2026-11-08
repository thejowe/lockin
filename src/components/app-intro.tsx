/**
 * La intro que se ve cada vez que se abre la app (arranque en frío).
 *
 * Una cortina negra —el mismo negro del splash nativo, para que no haya salto—
 * en la que el símbolo de cofounder se arma solo:
 *
 *   1. cada media luna entra desde su lado, se encuentran, chocan y rebotan
 *      una contra otra hasta quedar en su sitio;
 *   2. del choque sale el punto, disparado hacia arriba;
 *   3. cae al hueco del medio, se aplasta un instante y asienta; al aterrizar,
 *      las dos mitades se estremecen un poco y, en iPhone, el móvil vibra leve;
 *   4. el logo queda formado un momento y la cortina se funde para dejar ver la
 *      app, que ya estaba montada debajo.
 *
 * Dura ~2 s. Con «reducir movimiento» el logo se muestra ya formado, sin
 * rebotes ni vibración, y la cortina se funde.
 */

import * as Haptics from 'expo-haptics';
import { useCallback, useEffect } from 'react';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
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
import Svg, { Circle, Path } from 'react-native-svg';

import { ASPECT, LEFT, RIGHT, VIEW_BOX } from '@/components/cofounder-logo';
import { Colors, Curves, Springs } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

/** Tramos de la secuencia, en ms desde el arranque. */
const FLY_MS = 460; // las mitades llegan hasta el choque
const HIT_MS = FLY_MS; // instante del choque: sale el punto
const RISE_MS = 400; // el punto sube
const FALL_MS = 340; // …y cae
const LAND_MS = HIT_MS + RISE_MS + FALL_MS; // aterrizaje en el hueco
const HOLD_MS = 420; // el logo formado, quieto, antes de entrar a la app
const CURTAIN_DELAY_MS = LAND_MS + HOLD_MS;
const CURTAIN_MS = 340;
const REDUCED_HOLD_MS = 700;

/** Fracciones del ancho del logo. */
const START_X = 0.75; // de dónde parte cada mitad
const CROSS_X = 0.05; // cuánto se cruzan al chocar (sin llegar a fundirse)
const REBOUND_X = 0.1; // cuánto rebotan hacia fuera
const SHAKE_X = 0.035; // estremecimiento al caer el punto

const easeOut = Easing.bezier(...Curves.out);
const easeIn = Easing.bezier(0.55, 0, 1, 0.45); // acelera: es una caída

export function AppIntro({ onDone }: { onDone: () => void }) {
  const { width: screenWidth } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const width = Math.min(screenWidth * 0.5, 240);
  const height = width / ASPECT;
  // El punto sube casi el alto entero del logo y medio más.
  const rise = height * 1.5;

  // Desplazamiento horizontal de cada mitad, en fracción del ancho (positivo =
  // hacia fuera: la izquierda va a -x, la derecha a +x).
  const offset = useSharedValue(reduceMotion ? 0 : START_X);
  const shake = useSharedValue(0); // estremecimiento extra al caer el punto
  const halvesOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const dotY = useSharedValue(0);
  const dotScaleX = useSharedValue(1);
  const dotScaleY = useSharedValue(1);
  const dotOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const curtain = useSharedValue(1);

  const finish = useCallback(() => onDone(), [onDone]);
  const thud = useCallback(() => {
    if (Platform.OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      curtain.value = withDelay(
        REDUCED_HOLD_MS,
        withTiming(0, { duration: CURTAIN_MS }, (done) => {
          if (done) runOnJS(finish)();
        })
      );
      return;
    }

    halvesOpacity.value = withTiming(1, { duration: 140 });

    // Mitades: llegan, se cruzan un poco (choque), rebotan hacia fuera, se
    // asientan; y se estremecen una vez cuando cae el punto.
    offset.value = withSequence(
      withTiming(-CROSS_X, { duration: FLY_MS, easing: easeIn }),
      withTiming(REBOUND_X, { duration: 190, easing: easeOut }),
      withSpring(0, Springs.pop)
    );
    shake.value = withDelay(
      LAND_MS,
      withSequence(
        withTiming(SHAKE_X, { duration: 70, easing: easeOut }),
        withSpring(0, Springs.pop)
      )
    );

    // Punto: aparece en el choque, sube frenando, cae acelerando, se aplasta al
    // aterrizar y recupera la forma.
    dotOpacity.value = withDelay(HIT_MS, withTiming(1, { duration: 60 }));
    dotY.value = withDelay(
      HIT_MS,
      withSequence(
        withTiming(-rise, { duration: RISE_MS, easing: easeOut }),
        withTiming(0, { duration: FALL_MS, easing: easeIn }, (done) => {
          if (done) runOnJS(thud)();
        })
      )
    );
    const squash = (to: number) =>
      withDelay(
        LAND_MS,
        withSequence(withTiming(to, { duration: 70, easing: easeOut }), withSpring(1, Springs.pop))
      );
    dotScaleX.value = squash(1.35);
    dotScaleY.value = squash(0.65);

    curtain.value = withDelay(
      CURTAIN_DELAY_MS,
      withTiming(0, { duration: CURTAIN_MS, easing: Easing.bezier(...Curves.inOut) }, (done) => {
        if (done) runOnJS(finish)();
      })
    );
  }, [
    reduceMotion,
    offset,
    shake,
    halvesOpacity,
    dotY,
    dotScaleX,
    dotScaleY,
    dotOpacity,
    curtain,
    rise,
    finish,
    thud,
  ]);

  const curtainStyle = useAnimatedStyle(() => ({ opacity: curtain.value }));
  const leftStyle = useAnimatedStyle(() => ({
    opacity: halvesOpacity.value,
    transform: [{ translateX: -(offset.value + shake.value) * width }],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    opacity: halvesOpacity.value,
    transform: [{ translateX: (offset.value + shake.value) * width }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
    transform: [
      { translateY: dotY.value },
      { scaleX: dotScaleX.value },
      { scaleY: dotScaleY.value },
    ],
  }));

  const layer = { width, height };
  const fill = Colors.dark.text;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.curtain, curtainStyle]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="cofounder">
      <Animated.View pointerEvents="none" style={{ width, height }}>
        <Animated.View style={[styles.layer, layer, leftStyle]}>
          <Svg width={width} height={height} viewBox={VIEW_BOX}>
            <Path d={LEFT} transform="translate(-1 0)" fill={fill} />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.layer, layer, rightStyle]}>
          <Svg width={width} height={height} viewBox={VIEW_BOX}>
            <Path d={RIGHT} transform="translate(1 0)" fill={fill} />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.layer, layer, dotStyle]}>
          <Svg width={width} height={height} viewBox={VIEW_BOX}>
            <Circle cx={32} cy={32} r={5} fill={fill} />
          </Svg>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  curtain: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
