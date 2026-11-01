import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ambient-background';
import { Icon } from '@/components/icon';
import { enterUp } from '@/components/motion';
import { LoadingState, MessageState } from '@/components/state-view';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Control, MaxContentWidth, Opacity, Spacing } from '@/constants/theme';
import { useQuery, useRepositories, type ProfileInput } from '@/data';
import {
  Board,
  LinkAccounts,
  PhotoSection,
  TermsAcceptance,
  useTermsGate,
  ProfileDetails,
  ProfileForm,
  SectionEditSheet,
  type ProfileSection,
} from '@/features/profile';
import { accountsAvailable, enabledAuthProviders } from '@/features/profile/account-gateway';
import type { ConnectedApp } from '@/features/profile/connected-apps';
import { PrimaryButton, SecondaryButton } from '@/features/profile/controls';
import { initialDraft, toInput } from '@/features/profile/profile-form';
import { useTheme } from '@/hooks/use-theme';

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
  /** La hoja de cambiar la foto, que abre la cámara de la foto de arriba. */
  const [photoOpen, setPhotoOpen] = useState(false);
  /** El bloque que se edita en su hoja, desde el lápiz de ese bloque. */
  const [editSection, setEditSection] = useState<ProfileSection | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const theme = useTheme();
  const terms = useTermsGate();
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

  /** Guarda (o quita) el enlace de una red desde su logo; el resto de la ficha viaja intacto. */
  async function handleSaveLink(app: ConnectedApp, url: string | null) {
    if (!profile) return;
    const input = toInput(initialDraft(profile, null));
    await repositories.profiles.saveCurrent({
      ...input,
      links: { ...input.links, [app]: url ?? undefined },
    });
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

  // Quien creó el perfil antes de esta versión de los textos vuelve a aceptar
  // antes de publicar cambios.
  if (editing && terms.gate === 'required') {
    return (
      <Screen ambient="plum">
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
          <TermsAcceptance
            // Aceptados, de vuelta a la ficha: se edita bloque a bloque con su lápiz.
            onAccepted={() => {
              terms.refresh();
              setEditing(false);
            }}
            footer={<SecondaryButton label="Volver" onPress={() => setEditing(false)} />}
          />
        </SafeAreaView>
      </Screen>
    );
  }

  if (editing && terms.gate === 'accepted') {
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
          <View style={styles.topBar}>
            <ThemedText type="label" themeColor="textSecondary">
              Perfil
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ajustes de la cuenta"
              onPress={() => router.push('/settings')}
              style={({ pressed }) => [styles.gear, { opacity: pressed ? Opacity.pressed : 1 }]}>
              <Icon name="menu" size={26} color={theme.text} />
            </Pressable>
          </View>

          <Animated.View entering={enterUp(0)}>
            <ProfileDetails
              profile={profile}
              onAvatarPress={terms.gate === 'accepted' ? () => setPhotoOpen(true) : undefined}
              onEdit={terms.gate === 'accepted' ? setEditSection : undefined}
              onSaveLink={terms.gate === 'accepted' ? handleSaveLink : undefined}
            />
          </Animated.View>

          {terms.gate === 'accepted' ? (
            <>
              <PhotoSection
                profile={profile}
                onChange={refresh}
                visible={photoOpen}
                onClose={() => setPhotoOpen(false)}
              />
              <SectionEditSheet
                profile={profile}
                section={editSection}
                onSave={async (input) => {
                  await repositories.profiles.saveCurrent(input);
                  refresh();
                }}
                onClose={() => setEditSection(null)}
              />
            </>
          ) : terms.gate === 'required' ? (
            // Quien creó el perfil antes de esta versión de los textos los
            // acepta primero; luego ya edita cada bloque con su lápiz.
            <Animated.View entering={enterUp(1)} style={styles.termsGate}>
              <ThemedText type="body" themeColor="textSecondary">
                Para editar tu perfil o publicar una foto acepta antes los Términos y Normas.
              </ThemedText>
              <SecondaryButton label="Revisar y aceptar" onPress={() => setEditing(true)} />
            </Animated.View>
          ) : null}

          {/* El tablón propio: fotos del trabajo y de una misma (2026-10-17). */}
          <Animated.View entering={enterUp(2)}>
            <Board ownerId={profile.id} ownerName={profile.name} editable />
          </Animated.View>

          <Animated.View entering={enterUp(2)}>
            <LinkAccounts
              profile={profile}
              onChange={refresh}
              available={{ github: true, linkedin: linkedinAvailable }}
            />
          </Animated.View>

        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

/**
 * LinkedIn solo si esta compilación lo tiene configurado
 * (`EXPO_PUBLIC_AUTH_PROVIDERS`); con el mock, siempre, que lo simula.
 */
const linkedinAvailable = !accountsAvailable || enabledAuthProviders.has('linkedin');

const styles = StyleSheet.create({
  termsGate: {
    gap: Spacing.two,
  },
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gear: {
    width: Control.minTouch,
    height: Control.minTouch,
    marginRight: -Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
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
