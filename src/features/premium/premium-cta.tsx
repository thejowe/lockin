/**
 * El botón grande de «Hazte Premium» en Ajustes, y el diamante pequeño del perfil.
 *
 * Al pulsar cualquiera de los dos se abre el paywall con una sola escena
 * (dirección Premium: larga, sin rebote, `PaywallReveal`):
 *
 * 1. **Anticipación**: la gema se encoge un pelo bajo el dedo (háptico en iOS).
 * 2. **Vuelo**: la gema vuela en un arco suave hasta el sitio del héroe del
 *    paywall mientras se rellena (del trazo a la gema facetada) y crece; detrás,
 *    un círculo de noche azul se expande desde el botón hasta tapar la pantalla
 *    y el halo azul se enciende alrededor de la gema.
 * 3. **Relevo**: con todo tapado, el paywall abre debajo. Su gema y su halo
 *    están exactamente donde quedaron los de la animación (`heroCenter`), así
 *    que al retirar el velo no se ve el cambio: solo el contenido que entra.
 *
 * Con «reducir movimiento» no hay vuelo ni círculo: se abre el paywall sin más.
 */

import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewInstance,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  Extrapolation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import {
  Control,
  Curves,
  Opacity,
  PaywallReveal,
  PremiumTones,
  Radii,
  Spacing,
  Stroke,
} from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

import { openPaywall } from './open-paywall';
import { HERO_GEM, PremiumGem, PremiumHalo, heroCenter } from './premium-visuals';
import { t } from '@/i18n';

const GEM = 72;
/** El diamante del perfil: mismo gesto que el grande. */
const GEM_SMALL = 30;
/** Diámetro de partida del círculo de noche (cabe bajo la gema pequeña). */
const CIRCLE = 40;
/** Cuánto se tuerce el vuelo hacia fuera a mitad de camino: un arco, no una recta. */
const ARC = 28;

const easeGlide = Easing.bezier(...Curves.glide);
const easeOut = Easing.bezier(...Curves.out);

type Flight = {
  /** Centro del diamante pulsado, en coordenadas de ventana. */
  origin: { x: number; y: number };
  /** Escala del círculo que tapa la pantalla desde `origin`. */
  cover: number;
};

/**
 * La escena del diamante que vuela al héroe y abre el paywall. La comparten el
 * botón grande de Ajustes y el diamante pequeño del perfil.
 */
function useGemTakeover(size: number) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const gemRef = useRef<ViewInstance>(null);
  const [flight, setFlight] = useState<Flight | null>(null);

  /** Avance del vuelo, 0 → 1. */
  const progress = useSharedValue(0);
  /** La anticipación: un encogimiento breve antes de salir. */
  const squeeze = useSharedValue(1);
  /** Opacidad del velo entero (se retira tras abrir el paywall). */
  const veil = useSharedValue(1);

  const hero = heroCenter(insets, width);
  const start = size / HERO_GEM;
  const dx = flight ? flight.origin.x - hero.x : 0;
  const dy = flight ? flight.origin.y - hero.y : 0;
  const arcSign = dx >= 0 ? 1 : -1;
  const cover = flight?.cover ?? 1;

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.get() }));

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.get(), [0, 1], [0.4, cover]) }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0.35, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const gemStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const remaining = 1 - p;
    return {
      transform: [
        { translateX: dx * remaining + Math.sin(Math.PI * p) * ARC * arcSign },
        { translateY: dy * remaining },
        { scale: (start + (1 - start) * p) * squeeze.get() },
      ],
    };
  });

  // Del trazo a la gema facetada en el primer tercio del vuelo.
  const outlineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.35], [1, 0], Extrapolation.CLAMP),
  }));
  const solidStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0.05, 0.4], [0, 1], Extrapolation.CLAMP),
  }));

  function finish() {
    setFlight(null);
    progress.set(0);
    squeeze.set(1);
    veil.set(1);
  }

  /** Con la pantalla ya tapada: abre el paywall debajo y retira el velo. */
  function covered() {
    openPaywall({ fromGem: true });
    veil.set(
      withDelay(
        PaywallReveal.hold,
        withTiming(0, { duration: PaywallReveal.fade, easing: easeOut }, (done) => {
          if (done) scheduleOnRN(finish);
        })
      )
    );
  }

  function handlePress() {
    if (reduceMotion || !gemRef.current) {
      openPaywall();
      return;
    }
    if (Platform.OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    gemRef.current.measureInWindow((x, y, w, h) => {
      const origin = { x: x + w / 2, y: y + h / 2 };
      // Hasta la esquina más lejana, contando las barras del sistema.
      const fullHeight = height + insets.top + insets.bottom;
      const reach = Math.max(
        Math.hypot(origin.x, origin.y),
        Math.hypot(width - origin.x, origin.y),
        Math.hypot(origin.x, fullHeight - origin.y),
        Math.hypot(width - origin.x, fullHeight - origin.y)
      );
      progress.set(0);
      veil.set(1);
      squeeze.set(1);
      setFlight({ origin, cover: (reach * 2) / CIRCLE + 1 });
      squeeze.set(
        withSequence(
          withTiming(0.86, { duration: PaywallReveal.anticipate, easing: easeOut }),
          withTiming(1, { duration: PaywallReveal.cover / 2, easing: easeOut })
        )
      );
      progress.set(
        withDelay(
          PaywallReveal.anticipate,
          withTiming(1, { duration: PaywallReveal.cover, easing: easeGlide }, (done) => {
            if (done) scheduleOnRN(covered);
          })
        )
      );
    });
  }

  const overlay = (
    <Modal transparent statusBarTranslucent animationType="none" visible={flight !== null}>
      {flight ? (
        <Animated.View style={[StyleSheet.absoluteFill, veilStyle]} pointerEvents="none">
          <Animated.View
            style={[
              styles.circle,
              {
                left: flight.origin.x - CIRCLE / 2,
                top: flight.origin.y - CIRCLE / 2,
                backgroundColor: PremiumTones.night,
              },
              circleStyle,
            ]}
          />
          <Animated.View style={[StyleSheet.absoluteFill, haloStyle]}>
            <PremiumHalo breathe={false} backdrop={false} />
          </Animated.View>
          <Animated.View
            style={[
              styles.flyingGem,
              { left: hero.x - HERO_GEM / 2, top: hero.y - HERO_GEM / 2 },
              gemStyle,
            ]}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.center, outlineStyle]}>
              <Icon name="diamond" size={HERO_GEM} color={theme.diamond} strokeWidth={1.4} />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, styles.center, solidStyle]}>
              <PremiumGem size={HERO_GEM} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      ) : null}
    </Modal>
  );

  return { gemRef, handlePress, overlay, flying: flight !== null };
}

export function PremiumCta() {
  const theme = useTheme();
  const { gemRef, handlePress, overlay, flying } = useGemTakeover(GEM);

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
        {/* Mientras vuela la copia, el original no está: la gema «sale» del botón. */}
        <View ref={gemRef} collapsable={false} style={{ opacity: flying ? 0 : 1 }}>
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
 * (la gema vuela, tapa la pantalla y se abren los planes), sin entrar al menú.
 */
export function PremiumGemButton() {
  const theme = useTheme();
  const { gemRef, handlePress, overlay, flying } = useGemTakeover(GEM_SMALL);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Hazte Premium')}
        onPress={handlePress}
        style={({ pressed }) => [styles.gemButton, { opacity: pressed ? Opacity.pressed : 1 }]}>
        <View ref={gemRef} collapsable={false} style={{ opacity: flying ? 0 : 1 }}>
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
  circle: {
    position: 'absolute',
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
  },
  flyingGem: {
    position: 'absolute',
    width: HERO_GEM,
    height: HERO_GEM,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
