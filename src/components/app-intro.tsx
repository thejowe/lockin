/**
 * La intro que se ve cada vez que se abre la app (arranque en frío).
 *
 * Un telón negro —el mismo negro del splash nativo, para que no haya salto—
 * partido en dos hojas que se tocan en el centro. Cada media luna del símbolo va
 * cosida al borde de su hoja:
 *
 *   1. cada media luna entra desde su lado, se encuentran, chocan y rebotan
 *      una contra otra hasta quedar en su sitio;
 *   2. del choque sale el punto, disparado hacia arriba;
 *   3. cae al hueco del medio, se aplasta un instante y asienta; al aterrizar,
 *      las dos mitades se estremecen un poco y, en iPhone, el móvil vibra leve;
 *   4. el logo queda formado un momento; las mitades cogen impulso apretándose
 *      hacia dentro, el punto se apaga con un pop y las dos hojas se abren hacia
 *      los lados llevándose cada una su media luna: el telón destapa la página.
 *
 * La página de debajo (la bienvenida, si no hay cuenta) enseña su contenido en
 * cuanto el telón empieza a abrirse, para que lo que se destapa ya esté vivo.
 * Antes de abrir se espera, como mucho un momento, a saber a dónde va el
 * arranque (`intro-handoff`), para no destapar una pantalla a medio montar.
 *
 * Dura ~2,3 s. Con «reducir movimiento» el logo se muestra ya formado, sin
 * rebotes, vibración ni telón que se desliza: todo se funde.
 */

import * as Haptics from 'expo-haptics';
import { useCallback, useEffect } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { ASPECT, LEFT, RIGHT, VIEW_BOX } from '@/components/cofounder-logo';
import { introHandoff } from '@/components/intro-handoff';
import { Colors, Curves, Springs } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

/** Tramos de la secuencia, en ms desde el arranque. */
const FLY_MS = 460; // las mitades llegan hasta el choque
const HIT_MS = FLY_MS; // instante del choque: sale el punto
const RISE_MS = 400; // el punto sube
const FALL_MS = 340; // …y cae
const LAND_MS = HIT_MS + RISE_MS + FALL_MS; // aterrizaje en el hueco
const HOLD_MS = 360; // el logo formado, quieto, antes de irse
const DEPART_MS = LAND_MS + HOLD_MS;
const WINDUP_MS = 140; // las mitades se aprietan antes de abrir
const OPEN_MS = 760; // las hojas del telón se abren
const DOT_OUT_MS = 180; // el punto se apaga al empezar a abrir
const FADE_MS = 340; // solo con «reducir movimiento»
const DESTINATION_WAIT_MS = 800; // cuánto se espera a saber a dónde va el arranque
const REDUCED_HOLD_MS = 700;

/** Fracciones del ancho del logo. */
const START_X = 0.75; // de dónde parte cada mitad
const CROSS_X = 0.05; // cuánto se cruzan al chocar (sin llegar a fundirse)
const REBOUND_X = 0.1; // cuánto rebotan hacia fuera
const SHAKE_X = 0.035; // estremecimiento al caer el punto
const WINDUP_X = 0.025; // cuánto se aprietan antes de abrir el telón

/** Solape de las hojas en el centro, en puntos: sin él asoma una raya de la página. */
const SEAM_OVERLAP = 1;
/**
 * El filo de cada hoja: un brillo de tela que cae hacia dentro y una línea de luz
 * en el borde. La página de debajo también es negra; sin el filo, las hojas no se
 * leerían como telón. Se enciende al separarse (cerradas no hay costura visible).
 */
const EDGE_GLOW_W = 36;
const EDGE_GLOW_ALPHA = 0.09;
const EDGE_LINE_ALPHA = 0.32;
const EDGE_ON_AT = 0.06; // fracción de apertura a la que el filo ya está encendido

const easeOut = Easing.bezier(...Curves.out);
// Una intro por arranque: se enciende el relevo al importar, antes del primer render.
introHandoff.begin();

const easeIn = Easing.bezier(0.55, 0, 1, 0.45); // acelera: es una caída
// El telón pesa: arranca despacio, coge velocidad y llega frenando a los lados.
const curtainEase = Easing.bezier(0.65, 0, 0.2, 1);

export function AppIntro({ onDone }: { onDone: () => void }) {
  const { width: screenWidth } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const width = Math.min(screenWidth * 0.5, 240);
  const height = width / ASPECT;
  // El punto sube casi el alto entero del logo y medio más.
  const rise = height * 1.5;
  // Cada hoja cubre media pantalla y recorre exactamente eso al abrirse.
  const leaf = screenWidth / 2 + SEAM_OVERLAP;

  // Desplazamiento horizontal de cada mitad, en fracción del ancho (positivo =
  // hacia fuera: la izquierda va a -x, la derecha a +x).
  const offset = useSharedValue(reduceMotion ? 0 : START_X);
  const shake = useSharedValue(0); // estremecimiento extra al caer el punto
  const halvesOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const dotY = useSharedValue(0);
  const dotScaleX = useSharedValue(1);
  const dotScaleY = useSharedValue(1);
  const dotOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const dotOut = useSharedValue(1); // escala de salida del punto
  const open = useSharedValue(0); // 0 = telón cerrado, 1 = hojas fuera de pantalla
  const veil = useSharedValue(1); // opacidad de todo (solo se funde sin movimiento)

  const finish = useCallback(() => {
    // Por si el destape no llegó a dispararse (el efecto se reinició a mitad).
    if (introHandoff.get().active) introHandoff.finish();
    onDone();
  }, [onDone]);
  // La página de debajo se destapa ya: que enseñe su contenido.
  const reveal = useCallback(() => introHandoff.finish(), []);
  const thud = useCallback(() => {
    if (Platform.OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      // El ajuste puede llegar después del primer render: deja el logo formado y quieto.
      offset.value = 0;
      shake.value = 0;
      halvesOpacity.value = 1;
      dotY.value = 0;
      dotScaleX.value = 1;
      dotScaleY.value = 1;
      dotOpacity.value = 1;
      dotOut.value = 1;
      open.value = 0;
      const timer = setTimeout(() => {
        reveal();
        veil.value = withTiming(0, { duration: FADE_MS }, (done) => {
          if (done) runOnJS(finish)();
        });
      }, REDUCED_HOLD_MS);
      return () => clearTimeout(timer);
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

    // Al terminar el armado, el telón se abre: impulso, pop del punto y hojas fuera.
    let waitTimer: ReturnType<typeof setTimeout> | undefined;
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;
    let departed = false;

    const openCurtain = () => {
      if (departed) return;
      departed = true;
      unsubscribe?.();
      clearTimeout(waitTimer);

      offset.value = withSequence(
        withTiming(-WINDUP_X, { duration: WINDUP_MS, easing: easeOut }),
        withTiming(0, { duration: OPEN_MS, easing: curtainEase })
      );
      dotOut.value = withDelay(
        WINDUP_MS - 40,
        withSequence(
          withTiming(1.25, { duration: 80, easing: easeOut }),
          withTiming(0, { duration: DOT_OUT_MS, easing: easeIn })
        )
      );
      open.value = withDelay(
        WINDUP_MS,
        withTiming(1, { duration: OPEN_MS, easing: curtainEase }, (done) => {
          if (done) runOnJS(finish)();
        })
      );
      revealTimer = setTimeout(reveal, WINDUP_MS);
    };

    // Abre en cuanto el destino está listo; si aún no lo está, espera un poco.
    const decide = () => {
      const { destination, target } = introHandoff.get();
      if (destination === 'app' || (destination === 'welcome' && target?.settled)) openCurtain();
    };

    const depart = setTimeout(() => {
      decide();
      if (departed) return;
      unsubscribe = introHandoff.subscribe(decide);
      waitTimer = setTimeout(openCurtain, DESTINATION_WAIT_MS);
    }, DEPART_MS);

    return () => {
      departed = true;
      clearTimeout(depart);
      clearTimeout(waitTimer);
      clearTimeout(revealTimer);
      unsubscribe?.();
    };
  }, [
    reduceMotion,
    offset,
    shake,
    halvesOpacity,
    dotY,
    dotScaleX,
    dotScaleY,
    dotOpacity,
    dotOut,
    open,
    veil,
    rise,
    finish,
    reveal,
    thud,
  ]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: veil.value }));
  const leftLeafStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -open.value * leaf }],
  }));
  const rightLeafStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: open.value * leaf }],
  }));
  const leftStyle = useAnimatedStyle(() => ({
    opacity: halvesOpacity.value,
    transform: [{ translateX: -(offset.value + shake.value) * width - open.value * leaf }],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    opacity: halvesOpacity.value,
    transform: [{ translateX: (offset.value + shake.value) * width + open.value * leaf }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
    transform: [
      { translateY: dotY.value },
      { scaleX: dotScaleX.value * dotOut.value },
      { scaleY: dotScaleY.value * dotOut.value },
    ],
  }));

  const layer = { width, height };
  const fill = Colors.dark.text;

  return (
    <Animated.View
      // Las hojas tapan la app mientras están; al irse, los toques ya llegan a la página.
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, styles.root, rootStyle]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="cofounder">
      <Animated.View style={[styles.leaf, styles.leftLeaf, { width: leaf }, leftLeafStyle]}>
        <LeafEdge side="left" open={open} />
      </Animated.View>
      <Animated.View style={[styles.leaf, styles.rightLeaf, { width: leaf }, rightLeafStyle]}>
        <LeafEdge side="right" open={open} />
      </Animated.View>
      <View pointerEvents="none" style={{ width, height }}>
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
      </View>
    </Animated.View>
  );
}

function LeafEdge({ side, open }: { side: 'left' | 'right'; open: SharedValue<number> }) {
  const lit = useAnimatedStyle(() => ({
    opacity: interpolate(open.value, [0, EDGE_ON_AT], [0, 1], 'clamp'),
  }));
  const id = `leaf-edge-${side}`;
  // El brillo es máximo en el filo (el lado que mira al centro) y se apaga hacia fuera.
  const [x1, x2] = side === 'left' ? ['1', '0'] : ['0', '1'];
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.edge, side === 'left' ? styles.edgeLeft : styles.edgeRight, lit]}>
      <Svg width={EDGE_GLOW_W} height="100%">
        <Defs>
          <LinearGradient id={id} x1={x1} y1="0" x2={x2} y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={EDGE_GLOW_ALPHA} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      <View style={[styles.edgeLine, side === 'left' ? styles.edgeLeft : styles.edgeRight]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaf: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  leftLeaf: {
    left: 0,
  },
  rightLeaf: {
    right: 0,
  },
  edge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: EDGE_GLOW_W,
  },
  edgeLeft: {
    right: 0,
  },
  edgeRight: {
    left: 0,
  },
  edgeLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth * 2,
    backgroundColor: `rgba(255,255,255,${EDGE_LINE_ALPHA})`,
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
