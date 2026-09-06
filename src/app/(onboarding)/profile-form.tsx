import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useQuery, useRepositories, type ProfileInput } from '@/data';
import { ProfileForm } from '@/features/profile';

/**
 * Paso 2 del onboarding: crear el perfil.
 *
 * El formulario es el mismo componente que usa la tab Perfil para editar. Aquí
 * arranca vacío, con "qué busco" precargado desde el modo elegido en el paso 1.
 */
export default function ProfileFormScreen() {
  const router = useRouter();
  const repositories = useRepositories();

  const { data: session, loading } = useQuery('session:mode', () => repositories.session.get());

  async function handleSubmit(input: ProfileInput) {
    await repositories.profiles.saveCurrent(input);
    // `replace`: una vez creado el perfil, volver al onboarding no tiene sentido.
    router.replace('/discover');
  }

  // Esperamos al modo elegido antes de montar el formulario: si llegara después,
  // el campo "qué busco" ya estaría inicializado en vacío.
  if (loading) return null;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ProfileForm
        defaultLookingFor={session?.activeMode ?? null}
        submitLabel="Crear perfil"
        onSubmit={handleSubmit}
        header={
          <View style={styles.header}>
            <ThemedText type="label" themeColor="brass">
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
