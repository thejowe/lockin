/**
 * Tab Matches: con quién has conectado.
 *
 * Solo compone — la lectura de datos vive en `useMatches` y cada fila en
 * `MatchRow`, para que esta pantalla siga siendo legible cuando el bloque
 * `datos` cambie el mock por Supabase (no debería tocar nada de aquí).
 */

import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { MatchRow, MatchesEmpty, useMatches } from '@/features/chat';
import { useTheme } from '@/hooks/use-theme';

export default function MatchesScreen() {
  const theme = useTheme();
  const { data, loading, error, refresh } = useMatches();
  const matches = data ?? [];

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <FlatList
          data={matches}
          keyExtractor={(match) => match.id}
          renderItem={({ item }) => <MatchRow match={item} />}
          contentContainerStyle={[styles.list, matches.length === 0 && styles.listEmpty]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            <View style={styles.header}>
              <ThemedText type="label" themeColor="brass">
                Matches
              </ThemedText>
              <ThemedText type="title">Con quién has conectado</ThemedText>
              {error && (
                <ThemedText type="small" themeColor="danger">
                  No hemos podido cargar tus matches. Desliza hacia abajo para reintentar.
                </ThemedText>
              )}
            </View>
          }
          // Sin datos todavía no enseñamos el estado vacío: diría "no tienes
          // matches" cuando en realidad aún no lo sabemos.
          ListEmptyComponent={loading || error ? null : <MatchesEmpty />}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.brass} />
          }
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  listEmpty: {
    flexGrow: 1,
  },
  header: {
    gap: Spacing.one,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
  separator: {
    height: Spacing.two,
  },
});
