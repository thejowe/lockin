import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ambient-background';
import { CofounderLogo } from '@/components/cofounder-logo';
import { GlassButton } from '@/components/glass-button';
import { ThemedText } from '@/components/themed-text';
import { Curves, Duration, MaxContentWidth, Spacing } from '@/constants/theme';
import { useRepositories } from '@/data';
import { useRegistrationGate } from '@/features/profile';
import { accountsAvailable, registrationRequired } from '@/features/profile/account-gateway';

const easeOut = Easing.bezier(...Curves.out);

/** El nombre llega cuando el punto del logo ya ha aparecido. */
const WORDMARK_DELAY_MS = 900;
/** Y los botones, cuando el nombre ya se lee. */
const ACTIONS_DELAY_MS = 1250;

/**
 * La bienvenida: lo primero que ve quien abre cofounder sin perfil.
 *
 * Desde el 2026-10-17 es solo marca y dos salidas: el logo en grande con su
 * entrada (`CofounderLogo`) y, abajo, «Iniciar sesión» en cristal blanco y
 * «Registrarse» en cristal negro. Registrarse empieza el alta por «Sobre ti»
 * (`/about-you`); la cuenta y el correo van después, y el perfil al final.
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

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleRegister() {
    setSaving(true);
    setError(null);
    try {
      await repositories.session.setActiveMode('par');
      router.push('/about-you');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No hemos podido empezar el registro.');
    } finally {
      setSaving(false);
    }
  }

  if (gate === 'checking') return null;
  if (registrationRequired && gate === 'open') return <Redirect href="/profile-form" />;

  const logoWidth = Math.min(width * 0.56, 260);

  return (
    <Screen ambient="ember">
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.brand}>
          <CofounderLogo width={logoWidth} />
          <Animated.View
            entering={FadeInUp.duration(Duration.slow).easing(easeOut).delay(WORDMARK_DELAY_MS)}
            style={styles.wordmark}>
            <ThemedText type="display">cofounder</ThemedText>
            <ThemedText type="body" themeColor="textSecondary" style={styles.tagline}>
              Encuentra con quién construir.
            </ThemedText>
          </Animated.View>
        </View>

        {/*
          Sin fundido en el contenedor: en iOS 26 los botones son Liquid Glass y
          un `opacity` en un padre los deja sin pintar («Iniciar sesión» no se
          veía hasta pulsarlo). Cada botón aparece solo con `revealDelay`.
        */}
        <View style={styles.actions}>
          {error ? (
            <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
              {error}
            </ThemedText>
          ) : null}

          {/* Sin capa de cuentas (mock) no hay a qué entrar: ver `sign-in.tsx`. */}
          {accountsAvailable ? (
            <GlassButton
              label="Iniciar sesión"
              tint="light"
              revealDelay={ACTIONS_DELAY_MS}
              onPress={() => router.push('/sign-in')}
            />
          ) : null}
          <GlassButton
            label={saving ? 'Un momento…' : 'Registrarse'}
            tint="dark"
            revealDelay={ACTIONS_DELAY_MS}
            disabled={saving}
            onPress={() => void handleRegister()}
          />
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
