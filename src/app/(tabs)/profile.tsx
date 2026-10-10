import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ambient-background';
import { enterUp } from '@/components/motion';
import { LoadingState, MessageState } from '@/components/state-view';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useQuery, useRepositories, type ProfileInput } from '@/data';
import {
  AccountSection,
  GithubVerification,
  ProfileDetails,
  ProfileForm,
} from '@/features/profile';
import { PrimaryButton, SecondaryButton } from '@/features/profile/controls';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

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
  const scrollRef = useRef<ScrollView>(null);
  const reduceMotion = useReduceMotion();
  const {
    data: profile,
    loading,
    refresh,
  } = useQuery('profile:current', () => repositories.profiles.getCurrent());

  /**
   * Resincroniza el sello de GitHub al abrir la ficha.
   *
   * Es el único caso que ninguna otra pantalla cubre: si la persona se renombra
   * en GitHub, el sello se queda apuntando al handle viejo. Se hace aquí y no
   * en el arranque de la app porque sería una llamada de red en el camino
   * crítico de inicio para un caso raro.
   *
   * Sin sello no se llama: `refreshGithubVerification()` no enciende ninguno, y
   * pedirlo sería una llamada de red para nada.
   */
  const synced = useRef(false);
  const handle = profile?.githubVerification?.handle ?? null;

  useEffect(() => {
    if (!handle || synced.current) return;
    synced.current = true;

    let cancelled = false;
    repositories.profiles
      .refreshGithubVerification()
      .then((fresh) => {
        // Releer solo si de verdad cambió: si no, sería un render por nada.
        if (!cancelled && fresh.githubVerification?.handle !== handle) refresh();
      })
      .catch(() => {
        // Sincronizar es oportunista. Si falla, la ficha sigue enseñando el
        // sello que ya tenía, que es lo último que se sabe cierto — no hay
        // nada que contarle a quien solo venía a mirar su perfil.
      });

    return () => {
      cancelled = true;
    };
  }, [handle, refresh, repositories]);

  async function handleSubmit(input: ProfileInput) {
    await repositories.profiles.saveCurrent(input);
    setEditing(false);
    refresh();
  }

  if (loading) {
    return (
      <Screen ambient="plum">
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
          <LoadingState label="Cargando tu perfil…" />
        </SafeAreaView>
      </Screen>
    );
  }

  // Sin perfil no hay nada que enseñar. `index.tsx` ya redirige al onboarding,
  // así que esto solo se ve si alguien aterriza en la tab con la sesión a medias.
  if (!profile) {
    return (
      <Screen ambient="plum">
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
          <MessageState
            eyebrow="Perfil"
            title="Todavía no tienes ficha"
            body="Crea tu perfil para que la gente pueda encontrarte en el deck.">
            <PrimaryButton label="Crear perfil" onPress={() => router.replace('/mode')} />
          </MessageState>
        </SafeAreaView>
      </Screen>
    );
  }

  if (editing) {
    return (
      <Screen ambient="plum">
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
          <ProfileForm
            initial={profile}
            submitLabel="Guardar cambios"
            onSubmit={handleSubmit}
            onCancel={() => setEditing(false)}
            cancelLabel="Descartar cambios"
            header={
              <View style={styles.header}>
                <ThemedText type="label" themeColor="textSecondary">
                  Editar perfil
                </ThemedText>
                <ThemedText type="title">Tu ficha</ThemedText>
              </View>
            }
          />
        </SafeAreaView>
      </Screen>
    );
  }

  return (
    <Screen ambient="plum">
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
          <ThemedText type="label" themeColor="textSecondary">
            Perfil
          </ThemedText>

          <Animated.View entering={enterUp(0)}>
            <ProfileDetails profile={profile} />
          </Animated.View>

          <Animated.View entering={enterUp(1)}>
            <GithubVerification profile={profile} onChange={refresh} />
          </Animated.View>

          <Animated.View entering={enterUp(2)}>
            <SecondaryButton label="Editar perfil" onPress={() => setEditing(true)} />
          </Animated.View>

          {/* La cuenta va al final: es lo que menos se visita y donde vive la
            salida destructiva. Arriba está lo que se viene a mirar. */}
          <Animated.View entering={enterUp(3)}>
            <AccountSection
              onDeleted={() => router.replace('/')}
              onConfirmationShown={() =>
                scrollRef.current?.scrollToEnd({ animated: !reduceMotion })
              }
            />
          </Animated.View>
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
});
