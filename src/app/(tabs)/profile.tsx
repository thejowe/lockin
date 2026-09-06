import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useQuery, useRepositories, type ProfileInput } from '@/data';
import { ProfileDetails, ProfileForm } from '@/features/profile';
import { PrimaryButton, SecondaryButton } from '@/features/profile/controls';

/**
 * Tab Perfil: ver y editar la ficha propia.
 *
 * La edición reutiliza el formulario del onboarding (`ProfileForm`) en vez de
 * duplicar los campos: un campo nuevo aparece en los dos sitios a la vez.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const repositories = useRepositories();

  const [editing, setEditing] = useState(false);
  const {
    data: profile,
    loading,
    refresh,
  } = useQuery('profile:current', () => repositories.profiles.getCurrent());

  async function handleSubmit(input: ProfileInput) {
    await repositories.profiles.saveCurrent(input);
    setEditing(false);
    refresh();
  }

  if (loading) return null;

  // Sin perfil no hay nada que enseñar. `index.tsx` ya redirige al onboarding,
  // así que esto solo se ve si alguien aterriza en la tab con la sesión a medias.
  if (!profile) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.empty}>
          <ThemedText type="title">Todavía no tienes ficha</ThemedText>
          <ThemedText type="body" themeColor="textSecondary">
            Crea tu perfil para que la gente pueda encontrarte en el deck.
          </ThemedText>
          <PrimaryButton label="Crear perfil" onPress={() => router.replace('/mode')} />
        </View>
      </SafeAreaView>
    );
  }

  if (editing) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <ProfileForm
          initial={profile}
          submitLabel="Guardar cambios"
          onSubmit={handleSubmit}
          onCancel={() => setEditing(false)}
          cancelLabel="Descartar cambios"
          header={
            <View style={styles.header}>
              <ThemedText type="label" themeColor="brass">
                Editar perfil
              </ThemedText>
              <ThemedText type="title">Tu ficha</ThemedText>
            </View>
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="label" themeColor="brass">
          Perfil
        </ThemedText>

        <ProfileDetails profile={profile} />

        <SecondaryButton label="Editar perfil" onPress={() => setEditing(true)} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six + BottomTabInset,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    gap: Spacing.two,
    paddingTop: Spacing.four,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
});
