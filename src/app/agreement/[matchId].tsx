/**
 * Acuerdo de socios de un match Par: ocho temas a ciegas (spec § 2).
 *
 * El aviso legal va arriba, fijo y sin forma de cerrarlo. `distinto` no se
 * pinta como error. A esta pantalla se puede llegar por deep link, así que
 * resuelve sola el match ajeno o inexistente y el match Lock-In.
 */

import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { AgreementForbiddenError, AgreementModeError, useQuery, useRepositories } from '@/data';
import { AGREEMENT_CATALOG, SECTION_LABELS, TopicRow, useAgreement } from '@/features/agreement';
import { useTheme } from '@/hooks/use-theme';

import type { AgreementSection } from '@/features/agreement';

const LEGAL_NOTICE =
  'Esto no es un contrato ni asesoría legal. Sirve para hablar de lo difícil antes de que salga caro. Cuando vayáis en serio, id a un profesional.';

export default function AgreementScreen() {
  const theme = useTheme();
  const repositories = useRepositories();
  const params = useLocalSearchParams<{ matchId: string }>();
  const matchId = Array.isArray(params.matchId) ? params.matchId[0] : (params.matchId ?? '');

  const matchQuery = useQuery(`match:${matchId}`, () => repositories.matches.getById(matchId));
  const agreement = useAgreement(matchId);
  const match = matchQuery.data;

  // Un match ajeno se lee igual que uno que no existe: no se dice de quién es.
  const missing = match === null || agreement.error instanceof AgreementForbiddenError;
  const blocked = agreement.error instanceof AgreementModeError || match?.mode !== 'par';
  const failed = matchQuery.error ?? agreement.error;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Acuerdo de socios' }} />
      {matchQuery.loading || agreement.loading ? (
        <Centered title="Cargando…" loading />
      ) : missing ? (
        <Centered
          title="Esta conversación no está disponible"
          body={
            matchQuery.error
              ? 'Ha fallado la carga. Vuelve a tus matches y entra otra vez.'
              : 'El match ya no existe o no es tuyo.'
          }
        />
      ) : blocked ? (
        <Centered title="El acuerdo es solo para matches de cofundador." />
      ) : failed ? (
        <Centered
          title="No se ha podido cargar el acuerdo"
          body="Vuelve a tus matches y entra otra vez."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.notice, { backgroundColor: theme.brassSoft }]}>
            <ThemedText type="small">{LEGAL_NOTICE}</ThemedText>
          </View>
          {(Object.keys(SECTION_LABELS) as AgreementSection[]).map((section) => (
            <View key={section} style={styles.section}>
              <ThemedText type="subtitle">{SECTION_LABELS[section]}</ThemedText>
              {AGREEMENT_CATALOG.filter((topic) => topic.section === section).map((topic) => (
                <TopicRow
                  key={topic.key}
                  topic={topic}
                  view={agreement.views.find((view) => view.topic === topic.key)}
                  counterpartName={match.counterpart.name}
                  saving={agreement.savingTopic === topic.key}
                  onSave={(option, note) => void agreement.answer(topic.key, option, note)}
                />
              ))}
            </View>
          ))}
          {agreement.saveError && (
            <ThemedText type="small" themeColor="danger">
              No se ha podido guardar. Inténtalo de nuevo.
            </ThemedText>
          )}
          <Link href={{ pathname: '/chat/[matchId]', params: { matchId } }} asChild>
            <Pressable accessibilityRole="link" style={styles.back}>
              <ThemedText type="bodyStrong" style={{ color: theme.brass }}>
                Habladlo en el chat
              </ThemedText>
            </Pressable>
          </Link>
        </ScrollView>
      )}
    </View>
  );
}

/** Estado a pantalla completa. Fuera de la carga, siempre deja volver a Matches. */
function Centered({ title, body, loading }: { title: string; body?: string; loading?: boolean }) {
  const theme = useTheme();

  return (
    <View style={styles.centered}>
      <ThemedText
        type={loading ? 'body' : 'subtitle'}
        themeColor={loading ? 'textSecondary' : undefined}
        style={styles.centeredText}>
        {title}
      </ThemedText>
      {body && (
        <ThemedText type="body" themeColor="textSecondary" style={styles.centeredText}>
          {body}
        </ThemedText>
      )}
      {!loading && (
        <Link href="/matches" asChild>
          <Pressable accessibilityRole="link">
            <ThemedText type="bodyStrong" style={{ color: theme.brass }}>
              Volver a Matches
            </ThemedText>
          </Pressable>
        </Link>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.four },
  notice: { borderRadius: Radii.medium, padding: Spacing.three },
  section: { gap: Spacing.two },
  back: { alignItems: 'center', paddingVertical: Spacing.three },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  centeredText: { textAlign: 'center' },
});
