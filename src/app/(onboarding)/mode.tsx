import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ambient-background';
import { enterUp } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useRepositories } from '@/data';
import { useRegistrationGate } from '@/features/profile';
import { accountsAvailable } from '@/features/profile/account-gateway';
import { PrimaryButton, SecondaryButton } from '@/features/profile/controls';

/**
 * Paso 1 del onboarding: la bienvenida.
 *
 * Hasta el 2026-10-12 aquí se elegía modo (cofundador, Lock-In o ambos). Desde
 * entonces el producto es solo buscar cofundador, así que no hay nada que
 * elegir: la pantalla presenta la app y guarda el modo `par` en la sesión antes
 * de navegar, para que nada de lo que aún lee `activeMode` se quede a medias.
 * La ruta conserva su nombre (`/mode`) porque la enlazan el arranque, el
 * registro y el inicio de sesión.
 *
 * Sin la cuenta creada no se entra: el registro es obligatorio (2026-09-20) y la
 * puerta manda a `/register`. Está aquí y en `profile-form` porque son las dos
 * pantallas del alta a las que se puede llegar sin pasar por la otra.
 */
export default function ModeScreen() {
  const router = useRouter();
  const repositories = useRepositories();
  const gate = useRegistrationGate();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    setSaving(true);
    setError(null);
    try {
      await repositories.session.setActiveMode('par');
      router.push('/profile-form');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido guardar el modo.');
    } finally {
      setSaving(false);
    }
  }

  if (gate === 'checking') return null;
  if (gate === 'required') return <Redirect href="/register" />;

  return (
    <Screen ambient="ember">
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Animated.View entering={enterUp(0)} style={styles.header}>
            <ThemedText type="title">Encuentra con quién construir</ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              Desliza perfiles de gente que, como tú, quiere empezar algo grande. Si los dos os dais
              like, hay match y podéis hablar. Nadie contrata a nadie: los dos lados del match son
              pares.
            </ThemedText>
          </Animated.View>

          {error ? (
            <ThemedText type="small" themeColor="danger">
              {error}
            </ThemedText>
          ) : null}

          <PrimaryButton
            label={saving ? 'Guardando…' : 'Continuar'}
            disabled={saving}
            onPress={handleContinue}
          />

          {/* Opcional y sin capa de cuentas ni existe: ver `sign-in.tsx`. */}
          {accountsAvailable ? (
            <SecondaryButton label="Ya tengo cuenta" onPress={() => router.push('/sign-in')} />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    gap: Spacing.two,
  },
});
