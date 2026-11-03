/**
 * El velo con el logo latiendo que tapa el cambio de idioma.
 *
 * Al cambiar de idioma, `_layout.tsx` vuelve a montar toda la navegación (ver
 * `@/i18n`) y durante ese remontaje se veía un pantallazo negro. Este velo se
 * pinta en el mismo fotograma en que cambia el idioma y se retira solo, con un
 * fundido (nace opaco: un fundido de entrada dejaría ver el negro), cuando las pantallas ya están montadas.
 */

import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';

import { ThinkingLogo } from '@/components/cofounder-logo';
import { useTheme } from '@/hooks/use-theme';

/** Lo que dura el velo: más que el remontaje, menos que una espera notable. */
export const LOCALE_VEIL_MS = 900;

export function LocaleSwitchVeil({ locale }: { locale: string }) {
  const theme = useTheme();
  const [seen, setSeen] = useState(locale);
  const [visible, setVisible] = useState(false);

  // Se decide al renderizar, no en un efecto: así no hay un fotograma sin velo.
  if (seen !== locale) {
    setSeen(locale);
    setVisible(true);
  }

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), LOCALE_VEIL_MS);
    return () => clearTimeout(timer);
  }, [visible, seen]);

  if (!visible) return null;

  return (
    <Animated.View
      exiting={FadeOut.duration(220)}
      style={[StyleSheet.absoluteFill, styles.veil, { backgroundColor: theme.background }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="cofounder">
      <ThinkingLogo color={theme.brass} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  veil: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
