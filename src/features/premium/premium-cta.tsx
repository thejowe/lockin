/**
 * El botón grande de «Hazte Premium» en Ajustes, y el diamante pequeño del perfil.
 *
 * Al pulsar cualquiera de los dos se mide dónde está el diamante y se abre el
 * paywall con ese origen: la propia pantalla de pago (transparente sobre el
 * perfil) hace crecer el diamante desde ahí hasta tapar la pantalla y disuelve
 * su azul en los planes (ver `src/app/premium.tsx`).
 *
 * Hasta el 2026-11-10 el diamante crecía en un `Modal` de React Native y el
 * paywall abría debajo como otro modal nativo: en iOS los dos se presentaban y
 * retiraban en cadena y el perfil asomaba un instante entre medias. Ahora es una
 * sola pantalla y no hay relevo.
 *
 * Con «reducir movimiento» no hay diamante que crezca: el paywall entra con un
 * fundido.
 */

import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Control, Opacity, Radii, Spacing, Stroke } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

import { openPaywall } from './open-paywall';
import { t } from '@/i18n';

const GEM = 72;
/** El diamante del perfil: mismo gesto que el grande. */
const GEM_SMALL = 30;

/** Mide el diamante y abre el paywall desde él. */
function useGemTakeover(size: number) {
  const reduceMotion = useReduceMotion();
  const gemRef = useRef<ViewInstance>(null);

  function handlePress() {
    if (reduceMotion || !gemRef.current) {
      openPaywall();
      return;
    }
    if (Platform.OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    gemRef.current.measureInWindow((x, y, width, height) => {
      openPaywall({ origin: { x: x + width / 2, y: y + height / 2, size } });
    });
  }

  return { gemRef, handlePress };
}

export function PremiumCta() {
  const theme = useTheme();
  const { gemRef, handlePress } = useGemTakeover(GEM);

  return (
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
  );
}

/**
 * El diamante pequeño del perfil: mismo gesto que «Hazte Premium» de Ajustes
 * (el diamante crece, tapa la pantalla y se abren los planes), sin entrar al menú.
 */
export function PremiumGemButton() {
  const theme = useTheme();
  const { gemRef, handlePress } = useGemTakeover(GEM_SMALL);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('Hazte Premium')}
      onPress={handlePress}
      style={({ pressed }) => [styles.gemButton, { opacity: pressed ? Opacity.pressed : 1 }]}>
      <View ref={gemRef} collapsable={false}>
        <Icon name="diamond" size={GEM_SMALL} color={theme.diamond} strokeWidth={1.6} />
      </View>
    </Pressable>
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
});
