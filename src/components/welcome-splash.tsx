/**
 * La entrada a la app tras crear el perfil: el logo de cofounder con su
 * animación de bienvenida (la misma de la pantalla inicial), mientras el perfil
 * termina de guardarse y la app de cargar.
 *
 * Bajo el logo, el lema «ADN ganador» (en el idioma elegido) sube palabra a
 * palabra, en grande. Entra sola cuando la animación acaba y todo está listo
 * (`ready`); si se pulsa en cualquier momento, entra en cuanto está listo, sin
 * esperar a que acabe. Con «reducir movimiento» (Reanimated apaga las entradas) el
 * logo y el lema están quietos desde el primer fotograma y la espera es la misma.
 */

import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ambient-background';
import { CofounderLogo } from '@/components/cofounder-logo';
import { ThemedText } from '@/components/themed-text';
import { Curves, Duration, Spacing } from '@/constants/theme';
import { t } from '@/i18n';

/** Lo que dura la animación antes de entrar sola: el logo, el lema y un respiro para leerlo. */
export const SPLASH_MS = 3200;
/** El lema empieza cuando el punto del logo ya ha caído en su hueco. */
const MOTTO_DELAY_MS = 800;
/** Y cada palabra llega un poco después de la anterior. */
const MOTTO_STAGGER_MS = 180;

const easeOut = Easing.bezier(...Curves.out);

export function WelcomeSplash({ ready, onEnter }: { ready: boolean; onEnter: () => void }) {
  const { width } = useWindowDimensions();
  // En el idioma activo al pintar («ADN ganador», «Winning DNA», «ADN guanyador»).
  const motto = t('ADN ganador');
  const words = motto.split(' ');
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
        accessibilityLabel={t('Entrar a cofounder')}
        onPress={() => setTapped(true)}
        style={styles.fill}>
        <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
          <CofounderLogo width={Math.min(width * 0.56, 260)} />
          {/* Una palabra por línea, en grande, subiendo en escalera tras el logo. */}
          <View accessible accessibilityRole="header" accessibilityLabel={motto} style={styles.motto}>
            {words.map((word, index) => (
              <Animated.View
                key={`${word}-${index}`}
                entering={FadeInDown.duration(Duration.slow * 1.5)
                  .easing(easeOut)
                  .delay(MOTTO_DELAY_MS + index * MOTTO_STAGGER_MS)}>
                <ThemedText type="display" style={styles.mottoWord} numberOfLines={1} adjustsFontSizeToFit>
                  {word}
                </ThemedText>
              </Animated.View>
            ))}
          </View>
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
  motto: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  // Más grande que el `display` de siempre: es el remate de todo el alta.
  mottoWord: {
    fontSize: 60,
    lineHeight: 64,
    letterSpacing: -1.8,
    textAlign: 'center',
  },
});
