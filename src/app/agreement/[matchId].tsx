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
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
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

  // El match ajeno se lee igual que el inexistente: desde aquí no se distingue
  // uno de otro, y no hay por qué contar que el id existe.
  const missing = match === null || agreement.error instanceof AgreementForbiddenError;
  const blocked = agreement.error instanceof AgreementModeError || match?.mode !== 'par';

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Acuerdo de socios' }} />
      {matchQuery.loading || agreement.loading ? (
        <Centered text="Cargando…" back={false} />
      ) : missing ? (
        <Centered title="Esta conversación no está disponible" text="El match ya no existe." />
      ) : blocked ? (
        <Centered text="El acuerdo es solo para matches de cofundador." />
      ) : agreement.error ? (
        <Centered text="No se ha podido cargar el acuerdo.">
          <Pressable accessibilityRole="button" onPress={agreement.refresh}>
            <ThemedText type="bodyStrong" style={{ color: theme.brass }}>
              Reintentar
            </ThemedText>
          </Pressable>
        </Centered>
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

function Centered({
  title,
  text,
  back = true,
  children,
}: {
  title?: string;
  text: string;
  back?: boolean;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.centered}>
      {title && (
        <ThemedText type="subtitle" style={styles.centeredText}>
          {title}
        </ThemedText>
      )}
      <ThemedText type="body" themeColor="textSecondary" style={styles.centeredText}>
        {text}
      </ThemedText>
      {children}
      {back && (
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
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.three,
    gap: Spacing.four,
  },
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
