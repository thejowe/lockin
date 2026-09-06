/**
 * Tab Descubrir: el deck de swipe.
 *
 * Solo compone — el estado del deck vive en `useDeck` y el gesto en `SwipeDeck`,
 * para que cuando `datos` cambie el mock por Supabase esta pantalla no cambie.
 *
 * El filtro arranca en el modo elegido en el onboarding y se puede cambiar sin
 * salir de aquí; mientras la sesión se resuelve el deck se lee sin filtrar, que
 * es lo mismo que hace la capa de datos por debajo.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useQuery, useRepositories } from '@/data';
import { ActionButton, DeckEmpty, MatchModal, ModeFilter, SwipeDeck, useDeck } from '@/features/discover';
import { useTheme } from '@/hooks/use-theme';

import type { ModePreference } from '@/data';

export default function DiscoverScreen() {
  const theme = useTheme();
  const router = useRouter();
  const repositories = useRepositories();

  const { data: session } = useQuery('session:discover', () => repositories.session.get());
  /** Modo elegido en esta pantalla; `null` mientras mande el del onboarding. */
  const [override, setOverride] = useState<ModePreference | null>(null);
  const mode: ModePreference = override ?? session?.activeMode ?? 'ambos';

  const { cards, loading, error, match, decide, dismissMatch, refresh } = useDeck(mode);

  function openChat(matchId: string) {
    dismissMatch();
    router.push({ pathname: '/chat/[matchId]', params: { matchId } });
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemedText type="label" themeColor="brass">
              Descubrir
            </ThemedText>
            <ThemedText type="title">Quién está construyendo</ThemedText>
          </View>

          <ModeFilter value={mode} onChange={setOverride} />

          <View style={styles.deck}>
            {loading ? (
              <Centered>
                <ThemedText type="body" themeColor="textSecondary">
                  Buscando perfiles…
                </ThemedText>
              </Centered>
            ) : error && !cards?.length ? (
              <Centered>
                <ThemedText type="subtitle" style={styles.centeredText}>
                  No hemos podido cargar el deck
                </ThemedText>
                <ThemedText type="body" themeColor="textSecondary" style={styles.centeredText}>
                  Inténtalo otra vez en un momento.
                </ThemedText>
                <ActionButton label="Reintentar" onPress={refresh} />
              </Centered>
            ) : cards && cards.length > 0 ? (
              <SwipeDeck profiles={cards} onDecide={decide} />
            ) : (
              <DeckEmpty
                mode={mode}
                onOpenMatches={() => router.push('/matches')}
                onRefresh={refresh}
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

      <MatchModal event={match} onOpenChat={openChat} onDismiss={dismissMatch} />
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
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
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  header: {
    gap: Spacing.half,
  },
  deck: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  centeredText: {
    textAlign: 'center',
  },
});
