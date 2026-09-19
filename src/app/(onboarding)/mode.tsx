import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useRepositories, type ModePreference } from '@/data';
import { MODE_OPTIONS, useRegistrationGate } from '@/features/profile';
import { accountsAvailable } from '@/features/profile/account-gateway';
import { OptionCard, PrimaryButton, SecondaryButton } from '@/features/profile/controls';

/**
 * Paso 1 del onboarding: qué busca la persona.
 *
 * Guarda el modo en la sesión antes de navegar, para que el formulario del paso
 * 2 pueda precargar "qué busco" y el deck de `descubrir` arranque ya filtrado.
 *
 * Sin la cuenta creada no se entra: el registro es obligatorio (2026-09-20) y la
 * puerta manda a `/register`. Está aquí y en `profile-form` porque son las dos
 * pantallas del alta a las que se puede llegar sin pasar por la otra.
 */
export default function ModeScreen() {
  const router = useRouter();
  const repositories = useRepositories();
  const gate = useRegistrationGate();

  const [selected, setSelected] = useState<ModePreference | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!selected) return;

    setSaving(true);
    setError(null);
    try {
      await repositories.session.setActiveMode(selected);
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
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <ThemedText type="label" themeColor="brass">
            Paso 1 de 2
          </ThemedText>
          <ThemedText type="title">¿Qué buscas?</ThemedText>
          <ThemedText type="body" themeColor="textSecondary">
            Cofundador en igualdad de condiciones, compañero de Lock-In, o ambos. Nadie contrata a
            nadie: los dos lados del match son pares.
          </ThemedText>
        </View>

        <View style={styles.options}>
          {MODE_OPTIONS.map((option) => (
            <OptionCard
              key={option.value}
              option={option}
              selected={selected === option.value}
              onPress={() => setSelected(option.value)}
            />
          ))}
        </View>

        {error ? (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        ) : null}

        <PrimaryButton
          label={saving ? 'Guardando…' : 'Continuar'}
          disabled={!selected || saving}
          onPress={handleContinue}
        />

        {/* Opcional y sin capa de cuentas ni existe: ver `sign-in.tsx`. */}
        {accountsAvailable ? (
          <SecondaryButton label="Ya tengo cuenta" onPress={() => router.push('/sign-in')} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
  options: {
    gap: Spacing.two,
  },
});
