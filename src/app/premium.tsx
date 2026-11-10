import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/components/icon';
import { Curves, Duration, OnPremium, PaywallReveal, PremiumTones } from '@/constants/theme';
import { Paywall } from '@/features/premium/paywall';
import { ThemeOverride } from '@/hooks/use-theme';

/**
 * `/premium`: el paywall. Se abre desde el deck, Matches y Cuenta (ver
 * `openPaywall`). Términos y Privacidad abren su propia hoja.
 *
 * La pantalla es transparente (`transparentModal` sin animación del sistema) y
 * hace ella misma la entrada:
 *
 * - **Desde el diamante** (`?ox&oy&os`, centro y tamaño del diamante pulsado):
 *   un diamante azul macizo, encima del original, se encoge un pelo y crece
 *   hasta tapar la pantalla. Con todo azul, los planes ya están debajo y el
 *   azul se disuelve en la noche del paywall mientras el contenido entra en
 *   escalera. Una sola pantalla, sin relevo entre modales.
 * - **Desde cualquier otro sitio**: un fundido.
 *
 * Al cerrar, todo se funde y luego se vuelve atrás.
 */

/** Lado al que se dibuja el diamante que crece: grande para que no se pixele al escalar. */
const BASE = 240;
/**
 * Radio del círculo inscrito en el diamante del icono, medido desde el centro de
 * la caja (5,7 de 24 unidades: las aristas bajas son las más cercanas). Con él
 * se calcula cuánto crecer para tapar hasta la esquina más lejana.
 */
const INRADIUS = (5.7 / 24) * BASE;

const easeOut = Easing.bezier(...Curves.out);
const easeGlide = Easing.bezier(...Curves.glide);

type Origin = { x: number; y: number; size: number };

function parseOrigin(params: { ox?: string; oy?: string; os?: string }): Origin | null {
  const x = Number(params.ox);
  const y = Number(params.oy);
  const size = Number(params.os);
  if (!params.ox || !Number.isFinite(x) || !Number.isFinite(y) || !(size > 0)) return null;
  return { x, y, size };
}

export default function PremiumRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ox?: string; oy?: string; os?: string }>();
  // El origen se fija al montar: si la ruta se vuelve a pintar no se repite la escena.
  const [origin] = useState(() => parseOrigin(params));

  /** Escala del diamante que crece. */
  const grow = useSharedValue(origin ? origin.size / BASE : 1);
  /** Opacidad del diamante (se disuelve al final). */
  const blue = useSharedValue(origin ? 1 : 0);
  /** Opacidad del paywall entero: oculto bajo el diamante hasta que tapa. */
  const page = useSharedValue(0);
  /** Salida: al cerrar, todo se funde. */
  const exit = useSharedValue(1);

  useEffect(() => {
    if (!origin) {
      page.set(withTiming(1, { duration: Duration.slow, easing: easeOut }));
      return;
    }
    const { width, height } = Dimensions.get('screen');
    const reach = Math.max(
      Math.hypot(origin.x, origin.y),
      Math.hypot(width - origin.x, origin.y),
      Math.hypot(origin.x, height - origin.y),
      Math.hypot(width - origin.x, height - origin.y)
    );
    const start = origin.size / BASE;
    const cover = (reach / INRADIUS) * 1.08;

    grow.set(
      withSequence(
        withTiming(start * 0.86, { duration: PaywallReveal.anticipate, easing: easeOut }),
        withTiming(cover, { duration: PaywallReveal.cover, easing: easeGlide }, (done) => {
          if (!done) return;
          // Pantalla tapada: el paywall aparece debajo de golpe (no se ve) y el
          // azul se disuelve encima de él.
          page.set(1);
          blue.set(withTiming(0, { duration: PaywallReveal.dissolve, easing: easeOut }));
        })
      )
    );
  }, [origin, grow, blue, page]);

  const pageStyle = useAnimatedStyle(() => ({ opacity: page.get() * exit.get() }));
  const diamondStyle = useAnimatedStyle(() => ({
    opacity: blue.get() * exit.get(),
    transform: [{ scale: grow.get() }],
  }));

  function back() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  function close() {
    exit.set(
      withTiming(0, { duration: Duration.base, easing: easeOut }, (done) => {
        if (done) scheduleOnRN(back);
      })
    );
  }

  return (
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, pageStyle]}>
        <ThemeOverride.Provider value={OnPremium}>
          <Paywall
            entranceDelay={origin ? PaywallReveal.anticipate + PaywallReveal.cover : 0}
            onClose={close}
            onOpenLegal={(doc) => router.push({ pathname: '/legal/[doc]', params: { doc } })}
          />
        </ThemeOverride.Provider>
      </Animated.View>
      {origin ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.diamond,
            { left: origin.x - BASE / 2, top: origin.y - BASE / 2 },
            diamondStyle,
          ]}>
          <Icon
            name="diamond"
            size={BASE}
            color={PremiumTones.gemMid}
            fill={PremiumTones.gemMid}
            strokeWidth={1.4}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  diamond: {
    position: 'absolute',
    width: BASE,
    height: BASE,
  },
});
