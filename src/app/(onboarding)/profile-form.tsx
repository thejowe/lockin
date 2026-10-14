import { Redirect, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ambient-background';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useRepositories, type ProfileInput } from '@/data';
import {
  ProfileForm,
  TermsAcceptance,
  useRegistrationGate,
  useTermsGate,
} from '@/features/profile';

/**
 * Paso 2 del onboarding: crear el perfil.
 *
 * El formulario es el mismo componente que usa la tab Perfil para editar. Aquí
 * arranca vacío. No pregunta qué busca la persona: desde el 2026-10-12 el
 * producto es solo buscar cofundador.
 *
 * Con el registro obligatorio (2026-09-20) tampoco se llega aquí sin cuenta: la
 * puerta manda a `/register`, igual que `mode`, para que una URL directa no la
 * salte.
 */
export default function ProfileFormScreen() {
  const router = useRouter();
  const repositories = useRepositories();

  const gate = useRegistrationGate();
  const terms = useTermsGate();

  async function handleSubmit(input: ProfileInput) {
    await repositories.profiles.saveCurrent(input);
    // `replace`: una vez creado el perfil, volver al onboarding no tiene sentido.
    router.replace('/discover');
  }

  if (gate === 'checking') return null;
  if (gate === 'required') return <Redirect href="/register" />;
  if (terms.gate === 'checking') return null;

  // Sin Términos y Normas aceptados no se publica perfil.
  if (terms.gate === 'required') {
    return (
      <Screen ambient="plum">
        <SafeAreaView style={styles.root} edges={['top']}>
          <TermsAcceptance onAccepted={terms.refresh} />
        </SafeAreaView>
      </Screen>
    );
  }

  return (
    <Screen ambient="plum">
      <SafeAreaView style={styles.root} edges={['top']}>
        <ProfileForm
          submitLabel="Crear perfil"
          onSubmit={handleSubmit}
          header={
            <View style={styles.header}>
              <ThemedText type="label" themeColor="textSecondary">
                Paso 2 de 2
              </ThemedText>
              <ThemedText type="title">Cuéntate</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                Especialidades, punto de partida, disponibilidad, ambición y un par de respuestas
                cortas. Esto es lo que verá la gente al deslizar tu tarjeta.
              </ThemedText>
            </View>
          }
        />
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    gap: Spacing.two,
    paddingTop: Spacing.four,
  },
});
