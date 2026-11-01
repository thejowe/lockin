/**
 * La entrada a la app tras crear el perfil: el logo de cofounder con su
 * animación de bienvenida (la misma de la pantalla inicial), mientras el perfil
 * termina de guardarse y la app de cargar.
 *
 * Entra sola cuando la animación acaba y todo está listo (`ready`); si se pulsa
 * en cualquier momento, entra en cuanto está listo, sin esperar a que acabe. Con
 * «reducir movimiento» el logo está quieto y la espera es la misma.
 */

import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ambient-background';
import { CofounderLogo } from '@/components/cofounder-logo';
import { ThemedText } from '@/components/themed-text';
import { Curves, Duration, Spacing } from '@/constants/theme';

const easeOut = Easing.bezier(...Curves.out);

/** Lo que dura la animación antes de entrar sola: logo, nombre y un respiro. */
export const SPLASH_MS = 2200;
const WORDMARK_DELAY_MS = 700;

export function WelcomeSplash({ ready, onEnter }: { ready: boolean; onEnter: () => void }) {
  const { width } = useWindowDimensions();
  const [elapsed, setElapsed] = useState(false);
  const [tapped, setTapped] = useState(false);
  const entered = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setElapsed(true), SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (entered.current || !ready || !(elapsed || tapped)) return;
    entered.current = true;
    onEnter();
  }, [ready, elapsed, tapped, onEnter]);

  return (
    <Screen ambient="ember">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Entrar a cofounder"
        onPress={() => setTapped(true)}
        style={styles.fill}>
        <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
          <CofounderLogo width={Math.min(width * 0.56, 260)} />
          <Animated.View
            entering={FadeInUp.duration(Duration.slow).easing(easeOut).delay(WORDMARK_DELAY_MS)}>
            <ThemedText type="display">cofounder</ThemedText>
          </Animated.View>
        </SafeAreaView>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
  },
});
