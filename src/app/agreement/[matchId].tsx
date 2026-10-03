/**
 * Acuerdo de socios de un match Par: ocho temas a ciegas (spec § 2).
 *
 * El aviso legal va arriba, fijo y sin forma de cerrarlo. `distinto` no se
 * pinta como error. A esta pantalla se puede llegar por deep link, así que
 * resuelve sola el match ajeno o inexistente y el match Lock-In.
 */

import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AmbientBackground } from '@/components/ambient-background';
import { Button } from '@/components/button';
import { LoadingState, MessageState } from '@/components/state-view';
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
      <AmbientBackground variant="plum" />
      <Stack.Screen options={{ title: 'Acuerdo de socios' }} />
      {matchQuery.loading || agreement.loading ? (
        <LoadingState label="Cargando el acuerdo…" />
      ) : missing ? (
        <Centered title="Esta conversación no está disponible" text="El match ya no existe." />
      ) : blocked ? (
        <Centered text="El acuerdo es solo para matches de cofundador." />
      ) : agreement.error ? (
        <Centered text="No se ha podido cargar el acuerdo.">
          <Button label="Reintentar" onPress={agreement.refresh} />
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

/** Aviso de pantalla completa. La salida por defecto es volver a Matches. */
function Centered({
  title,
  text,
  children,
}: {
  title?: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <MessageState eyebrow="Acuerdo de socios" title={title} body={text}>
      {children}
      <Button
        label="Volver a Matches"
        href="/matches"
        variant={children ? 'secondary' : 'primary'}
      />
    </MessageState>
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
});
