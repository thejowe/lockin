/**
 * Tab Descubrir: el deck de swipe, a pantalla completa como en Tinder.
 *
 * Solo compone — el estado del deck vive en `useDeck` y el gesto en `SwipeDeck`,
 * para que cuando `datos` cambie el mock por Supabase esta pantalla no cambie.
 *
 * Sin cabecera ni filtro: desde el 2026-10-12 el producto es solo buscar
 * cofundador, así que el deck se lee siempre en modo `par` y la tarjeta se
 * queda con todo el alto que deja la barra de pestañas.
 *
 * También lee el perfil propio, y solo por una cosa: qué domina uno, para que
 * la tarjeta pueda resaltar el encaje con lo que la otra persona busca. Es una
 * señal para quien decide, no un filtro — el deck y el match no la miran (ver
 * `features/discover/complement.ts`).
 */

import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/ambient-background';
import { LoadingState, MessageState } from '@/components/state-view';
import { useLockTabSwipe } from '@/components/swipe-between-tabs';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useQuery, useRepositories } from '@/data';
import {
  ActionButton,
  DeckEmpty,
  MatchModal,
  OutOfLikesSheet,
  SwipeDeck,
  useDeck,
} from '@/features/discover';
import { openPaywall } from '@/features/premium';
import { useTheme } from '@/hooks/use-theme';

import type { ModePreference, Specialty } from '@/data';

/** El único modo del producto: buscar cofundador. Lock-In queda fuera de la UI. */
const DECK_MODE: ModePreference = 'par';

/** Constante para no crear un array nuevo en cada render mientras no hay perfil. */
const EMPTY_SPECIALTIES: Specialty[] = [];

export default function DiscoverScreen() {
  const theme = useTheme();
  const router = useRouter();
  const repositories = useRepositories();

  const { data: viewer } = useQuery('profile:discover', () => repositories.profiles.getCurrent());
  /** Vacío mientras el perfil carga: la tarjeta simplemente no resalta nada. */
  const viewerSpecialties = viewer?.specialties ?? EMPTY_SPECIALTIES;
  /** Igual: sin perfil propio, la jornada no marca coincidencias. */
  const viewerSchedule = viewer
    ? { bands: viewer.availability.bands, timezone: viewer.timezone }
    : undefined;
  const {
    cards,
    loading,
    error,
    match,
    blocked,
    quotas,
    decide,
    superLike,
    undo,
    boost,
    checkLikeLimit,
    dismissBlocked,
    dismissMatch,
    refresh,
  } = useDeck(DECK_MODE);
  // Sin Premium y sin likes, el like no sale: la tarjeta vuelve y se abre la hoja.
  const likeLocked = quotas !== null && !quotas.isPremium && quotas.likesLeft === 0;

  // Con tarjetas, el swipe horizontal es de la tarjeta; sin ellas (deck vacío,
  // cargando o en error) deslizar lleva a la pestaña de al lado.
  useLockTabSwipe(!loading && !!cards && cards.length > 0);

  function openChat(matchId: string) {
    dismissMatch();
    router.push({ pathname: '/chat/[matchId]', params: { matchId } });
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <AmbientBackground variant="ember" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.deck}>
            {loading ? (
              <LoadingState label="Buscando perfiles…" />
            ) : error && !cards?.length ? (
              <MessageState
                title="No hemos podido cargar el deck"
                body="Inténtalo otra vez en un momento.">
                <ActionButton label="Reintentar" onPress={refresh} />
              </MessageState>
            ) : cards && cards.length > 0 ? (
              <SwipeDeck
                profiles={cards}
                onDecide={decide}
                viewerSpecialties={viewerSpecialties}
                viewerSchedule={viewerSchedule}
                likeLocked={likeLocked}
                onLikeLocked={() => void checkLikeLimit()}
                isPremium={quotas?.isPremium ?? false}
                likesLeft={quotas?.likesLeft ?? null}
                onUndo={() => void undo()}
                onSuperLike={(profile) => superLike(profile.id)}
                onBoost={() => void boost()}
              />
            ) : (
              <DeckEmpty
                onOpenMatches={() => router.push('/matches')}
                onRefresh={refresh}
                onUndo={quotas?.isPremium ? () => void undo() : undefined}
              />
            )}
          </View>

          {error && cards && cards.length > 0 ? (
            <ThemedText type="small" themeColor="danger">
              No hemos podido guardar tu última decisión. La tarjeta sigue en el deck.
            </ThemedText>
          ) : null}
        </View>
      </SafeAreaView>

      <OutOfLikesSheet
        blocked={blocked}
        isPremium={quotas?.isPremium ?? false}
        onClose={dismissBlocked}
        onUpgrade={() => {
          dismissBlocked();
          openPaywall();
        }}
      />

      <MatchModal
        event={match}
        onOpenChat={openChat}
        onDismiss={dismissMatch}
        viewerSpecialties={viewerSpecialties}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.one,
    paddingBottom: BottomTabInset + Spacing.one,
  },
  deck: {
    flex: 1,
  },
});
