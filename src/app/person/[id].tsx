import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { LoadingState, MessageState } from '@/components/state-view';
import { ThemedText } from '@/components/themed-text';
import { HitSlop, MaxContentWidth, Spacing } from '@/constants/theme';
import { useQuery, useRepositories } from '@/data';
import { Board, ProfileDetails, RequireVerifiedEmail } from '@/features/profile';
import { useTheme } from '@/hooks/use-theme';

/**
 * `/person/<id>`: el perfil completo de otra persona, en una hoja que sube sobre
 * donde se estaba (`presentation: 'modal'` en `src/app/_layout.tsx`).
 *
 * Se abre desde el botón «i» de la tarjeta del deck y tocando a la persona en la
 * cabecera del chat (decisión del usuario del 2026-10-17). Es la misma ficha que
 * se ve de uno mismo en Perfil (`ProfileDetails`): sus redes, sus sellos y lo
 * que cuenta. Solo lectura: aquí no se decide nada, el Like/Pasar sigue en el
 * deck.
 *
 * Sin email confirmado no se ve nada de dentro, como en el chat
 * (`RequireVerifiedEmail`); y con un bloqueo, en cualquier sentido, el
 * repositorio no devuelve la ficha y aquí se lee como «no disponible».
 */
export default function PersonRoute() {
  return (
    <RequireVerifiedEmail>
      <Person />
    </RequireVerifiedEmail>
  );
}

function Person() {
  const router = useRouter();
  const repositories = useRepositories();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    data: profile,
    loading,
    error,
    refresh,
  } = useQuery(`person:${id}`, () => repositories.profiles.getById(String(id)));

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <>
      <Stack.Screen
        options={{
          title: profile?.name ?? 'Perfil',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              hitSlop={HitSlop.inline}
              onPress={close}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
              <ThemedText type="bodyStrong" style={{ color: theme.text }}>
                Cerrar
              </ThemedText>
            </Pressable>
          ),
        }}
      />
      {loading ? (
        <LoadingState label="Abriendo el perfil…" />
      ) : error ? (
        <MessageState
          title="No hemos podido abrir este perfil"
          body="Comprueba tu conexión y vuelve a intentarlo."
          detail={error.message}>
          <Button label="Reintentar" onPress={refresh} />
        </MessageState>
      ) : !profile ? (
        <MessageState
          title="Este perfil ya no está disponible"
          body="Puede que la persona haya borrado su cuenta.">
          <Button label="Cerrar" variant="secondary" onPress={close} />
        </MessageState>
      ) : (
        <ScrollView
          style={{ backgroundColor: theme.background }}
          contentContainerStyle={[styles.content, { paddingBottom: Spacing.six + insets.bottom }]}>
          <ProfileDetails profile={profile} />
          <Board ownerId={profile.id} ownerName={profile.name} />
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  close: {
    paddingHorizontal: 4,
  },
  pressed: {
    opacity: 0.6,
  },
});
