import { Redirect, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View, type HostInstance } from 'react-native';
import Animated, { Easing, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ambient-background';
import { CofounderLogo } from '@/components/cofounder-logo';
import { GlassButton } from '@/components/glass-button';
import { introHandoff, useIntroActive } from '@/components/intro-handoff';
import { ThemedText } from '@/components/themed-text';
import { Curves, Duration, MaxContentWidth, Spacing } from '@/constants/theme';
import { useRepositories } from '@/data';
import { useRegistrationGate } from '@/features/profile';
import { accountsAvailable, registrationRequired } from '@/features/profile/account-gateway';
import { t } from '@/i18n';

const easeOut = Easing.bezier(...Curves.out);

/** El nombre llega cuando el punto del logo ya ha aparecido. */
const WORDMARK_DELAY_MS = 900;
/** Y los botones, cuando el nombre ya se lee. */
const ACTIONS_DELAY_MS = 1250;
/** Si el logo llega volando desde la intro, los botones entran justo después. */
const ACTIONS_AFTER_INTRO_MS = 200;

/**
 * La bienvenida: lo primero que ve quien abre cofounder sin perfil.
 *
 * Desde el 2026-10-17 es solo marca y dos salidas: el logo en grande con su
 * entrada (`CofounderLogo`) y, abajo, «Iniciar sesión» en cristal blanco y
 * «Registrarse» en cristal negro. Registrarse empieza el alta por la cuenta
 * (`/register`: correo, contraseña y verificación); nombre, edad y ubicación se
 * piden después, dentro del formulario del perfil. Sin capa de cuentas (mock) va
 * directo al formulario.
 *
 * Guarda el modo `par` antes de seguir, como hacía la elección de modo que hubo
 * aquí hasta el 2026-10-12, para que nada de lo que aún lee `activeMode` se
 * quede a medias. La ruta conserva su nombre (`/mode`) porque la enlazan el
 * arranque, el registro y el inicio de sesión.
 *
 * Quien ya tiene la cuenta confirmada y aún no tiene perfil no pinta nada aquí:
 * lo que le falta es el formulario.
 *
 * «Continuar con Google / Apple» vive desde el 2026-10-29 dentro de «Iniciar
 * sesión» y de «Registrarse» (`provider-buttons.tsx`), no aquí.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const repositories = useRepositories();
  const gate = useRegistrationGate();
  const { width } = useWindowDimensions();
  // Si la bienvenida se monta con la intro en pantalla, el logo llega volando
  // desde ella: aquí se esconde y se pinta quieto hasta que aterriza.
  const introActive = useIntroActive();
  const [duringIntro] = useState(introActive);
  const logoRef = useRef<HostInstance>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleRegister() {
    setSaving(true);
    setError(null);
    try {
      await repositories.session.setActiveMode('par');
      router.push(registrationRequired ? '/register' : '/profile-form');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('No hemos podido empezar el registro.'));
    } finally {
      setSaving(false);
    }
  }

  if (gate === 'checking') return null;
  if (registrationRequired && gate === 'open') return <Redirect href="/profile-form" />;

  // Dice a la intro dónde está el logo. Se mide dos veces: al montar la pantalla
  // puede seguir deslizándose al entrar, y la segunda medida ya es la definitiva.
  const publishLogoTarget = () => {
    if (!introHandoff.get().active) return;
    const measure = (settled: boolean) =>
      logoRef.current?.measureInWindow((x, y, w) => {
        if (w) introHandoff.setTarget({ x, y, width: w, settled });
      });
    measure(false);
    setTimeout(() => measure(true), 450);
  };

  const logoWidth = Math.min(width * 0.56, 260);

  const wordmarkText = (
    <>
      <ThemedText type="display">cofounder</ThemedText>
      <Animated.View
        entering={FadeInUp.duration(Duration.slow)
          .easing(easeOut)
          .delay((duringIntro ? 0 : WORDMARK_DELAY_MS) + Duration.slow)}>
        <ThemedText type="body" themeColor="textSecondary" style={styles.tagline}>
          Winning DNA
        </ThemedText>
      </Animated.View>
    </>
  );

  return (
    <Screen ambient="ember">
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.brand}>
          <View
            ref={logoRef}
            collapsable={false}
            onLayout={publishLogoTarget}
            style={{ opacity: introActive ? 0 : 1 }}>
            <CofounderLogo width={logoWidth} animated={!duringIntro} />
          </View>
          {introActive ? (
            // Ocupa su sitio (para que el logo no se mueva al llegar el texto).
            <View
              style={[styles.wordmark, { opacity: 0 }]}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden>
              {wordmarkText}
            </View>
          ) : (
            <Animated.View
              entering={FadeInUp.duration(Duration.slow)
                .easing(easeOut)
                .delay(duringIntro ? 0 : WORDMARK_DELAY_MS)}
              style={styles.wordmark}>
              {wordmarkText}
            </Animated.View>
          )}
        </View>

        {/*
          Sin fundido en el contenedor: en iOS 26 los botones son Liquid Glass y
          un `opacity` en un padre los deja sin pintar («Iniciar sesión» no se
          veía hasta pulsarlo). Cada botón aparece solo con `revealDelay`.
        */}
        <View style={styles.actions}>
          {introActive ? null : (
            <>
              {error ? (
                <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
                  {error}
                </ThemedText>
              ) : null}

              {/* Sin capa de cuentas (mock) no hay a qué entrar: ver `sign-in.tsx`. */}
              {accountsAvailable ? (
                <GlassButton
                  label={t('Iniciar sesión')}
                  tint="light"
                  revealDelay={duringIntro ? ACTIONS_AFTER_INTRO_MS : ACTIONS_DELAY_MS}
                  onPress={() => router.push('/sign-in')}
                />
              ) : null}
              <GlassButton
                label={saving ? t('Un momento…') : t('Registrarse')}
                tint="dark"
                revealDelay={duringIntro ? ACTIONS_AFTER_INTRO_MS : ACTIONS_DELAY_MS}
                disabled={saving}
                onPress={() => void handleRegister()}
              />
            </>
          )}
        </View>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
  },
  brand: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
  },
  wordmark: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  tagline: {
    textAlign: 'center',
  },
  actions: {
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
