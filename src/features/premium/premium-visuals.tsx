/**
 * Las piezas visuales de Premium que comparten el paywall y la animación que lo
 * abre (`premium-cta.tsx`): la gema facetada, el halo de fondo y la geometría
 * del héroe.
 *
 * La gema del héroe y el halo comparten geometría (`heroCenter`): el halo se
 * centra en la gema.
 *
 * Capa ambiental: el halo respira y tres destellos parpadean alrededor de la
 * gema. Con «reducir movimiento» todo queda quieto en su punto medio.
 */

import { useEffect, useId } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import Svg, {
  Defs,
  G,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { Control, PremiumTones } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

/** Lado de la gema del héroe. */
export const HERO_GEM = 108;
/** Alto de la franja del héroe (gema + aire para los destellos). */
export const HERO_BOX = 156;

/**
 * Centro de la gema del héroe en coordenadas de ventana, con el paywall recién
 * abierto (sin desplazar): barra superior (`Control.minTouch`) y luego la franja
 * del héroe. La animación del diamante vuela hasta aquí.
 */
export function heroCenter(insets: EdgeInsets, width: number): { x: number; y: number } {
  return { x: width / 2, y: insets.top + Control.minTouch + HERO_BOX / 2 };
}

const easeSine = Easing.inOut(Easing.sin);

/**
 * La gema facetada: corona clara, pabellón en sombra y aristas de luz. Se dibuja
 * a su tamaño final; la animación la escala desde abajo, así que nunca se pixela.
 */
export function PremiumGem({ size }: { size: number }) {
  const id = useId().replace(/:/g, '');
  const body = `gem-body-${id}`;
  const shine = `gem-shine-${id}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={body} x1="0.1" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor={PremiumTones.gemLight} />
          <Stop offset="0.45" stopColor={PremiumTones.gemMid} />
          <Stop offset="1" stopColor={PremiumTones.gemDeep} />
        </LinearGradient>
        <LinearGradient id={shine} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {/* Silueta. */}
      <Polygon points="24,16 76,16 97,40 50,93 3,40" fill={`url(#${body})`} />
      {/* Corona: facetas con más o menos luz. */}
      <Polygon points="3,40 24,16 36,40" fill="#FFFFFF" fillOpacity={0.5} />
      <Polygon points="24,16 36,40 50,16" fill="#FFFFFF" fillOpacity={0.22} />
      <Polygon points="50,16 36,40 64,40" fill={`url(#${shine})`} fillOpacity={0.55} />
      <Polygon points="50,16 64,40 76,16" fill="#FFFFFF" fillOpacity={0.12} />
      <Polygon points="76,16 97,40 64,40" fill="#000000" fillOpacity={0.08} />
      {/* Pabellón. */}
      <Polygon points="3,40 36,40 50,93" fill="#FFFFFF" fillOpacity={0.16} />
      <Polygon points="64,40 97,40 50,93" fill="#0A0640" fillOpacity={0.32} />
      {/* Aristas. */}
      <G stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={0.9} strokeLinejoin="round" fill="none">
        <Path d="M24 16h52l21 24-47 53L3 40z" />
        <Path d="M3 40h94M24 16l12 24 14 53 14-53 12-24M36 40l14-24 14 24" />
      </G>
      {/* Brillo de la arista superior izquierda. */}
      <Path d="M27 19h20" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

/** Estrella de cuatro puntas: los destellos alrededor de la gema. */
function Glint({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 0c.9 6.6 4.5 10.6 12 12-7.5 1.4-11.1 5.4-12 12-.9-6.6-4.5-10.6-12-12C7.5 10.6 11.1 6.6 12 0z"
        fill={color}
      />
    </Svg>
  );
}

/** Un destello que parpadea en bucle, desfasado por `delay`. */
function TwinkleGlint({
  size,
  delay,
  style,
}: {
  size: number;
  delay: number;
  style: { left: number; top: number };
}) {
  const reduceMotion = useReduceMotion();
  const t = useSharedValue(0.5);

  useEffect(() => {
    if (reduceMotion) {
      t.set(0.5);
      return;
    }
    t.set(0);
    t.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 900, easing: easeSine }),
            withTiming(0, { duration: 900, easing: easeSine }),
            withTiming(0, { duration: 1400 })
          ),
          -1
        )
      )
    );
    return () => cancelAnimation(t);
  }, [reduceMotion, delay, t]);

  const animated = useAnimatedStyle(() => ({
    opacity: 0.25 + t.get() * 0.75,
    transform: [{ scale: 0.6 + t.get() * 0.4 }, { rotate: `${t.get() * 45}deg` }],
  }));

  return (
    <Animated.View style={[styles.glint, style, animated]}>
      <Glint size={size} color={PremiumTones.gemLight} />
    </Animated.View>
  );
}

/** La gema del héroe con sus destellos. */
export function HeroGem() {
  return (
    <View style={styles.hero} pointerEvents="none">
      <View style={styles.heroBox}>
        <PremiumGem size={HERO_GEM} />
        <TwinkleGlint size={18} delay={300} style={{ left: 2, top: 18 }} />
        <TwinkleGlint size={12} delay={1300} style={{ left: HERO_BOX - 22, top: 38 }} />
        <TwinkleGlint size={10} delay={2100} style={{ left: HERO_BOX - 34, top: 120 }} />
      </View>
    </View>
  );
}

/**
 * El halo de luz azul detrás del héroe, a pantalla completa y fijo (no se
 * desplaza con el contenido). Respira despacio salvo con «reducir movimiento».
 * `backdrop` pinta además la noche de fondo; se puede quitar para
 * usarlo sobre otro fondo.
 */
export function PremiumHalo({
  breathe = true,
  backdrop = true,
}: {
  breathe?: boolean;
  backdrop?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const center = heroCenter(insets, width);
  const id = useId().replace(/:/g, '');
  const warm = `halo-${id}`;
  const cool = `halo-cool-${id}`;
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!breathe || reduceMotion) {
      pulse.set(1);
      return;
    }
    pulse.set(withRepeat(withTiming(0.7, { duration: 2800, easing: easeSine }), -1, true));
    return () => cancelAnimation(pulse);
  }, [breathe, reduceMotion, pulse]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.get() }));
  const radius = width * 0.95;

  return (
    <View
      style={[StyleSheet.absoluteFill, backdrop && { backgroundColor: PremiumTones.night }]}
      pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, animated]}>
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient
              id={warm}
              cx={center.x}
              cy={center.y}
              r={radius}
              gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={PremiumTones.halo} stopOpacity={0.55} />
              <Stop offset="0.35" stopColor={PremiumTones.halo} stopOpacity={0.18} />
              <Stop offset="1" stopColor={PremiumTones.halo} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient
              id={cool}
              cx={center.x + width * 0.35}
              cy={center.y - 40}
              r={radius * 0.7}
              gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={PremiumTones.haloCool} stopOpacity={0.35} />
              <Stop offset="1" stopColor={PremiumTones.haloCool} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={width} height={height} fill={`url(#${warm})`} />
          <Rect width={width} height={height} fill={`url(#${cool})`} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: HERO_BOX,
    alignItems: 'center',
  },
  heroBox: {
    width: HERO_BOX,
    height: HERO_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glint: {
    position: 'absolute',
  },
});
