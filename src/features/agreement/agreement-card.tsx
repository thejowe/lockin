/**
 * Entrada al acuerdo de socios desde el chat, debajo de `SessionCard`.
 *
 * Solo en matches Par: en Lock-In devuelve `null`, así el chat la monta sin
 * condición y la regla vive en un solo sitio. No importa nada de
 * `@/features/session`.
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { summarize } from './status';
import { useAgreement } from './use-agreement';

import type { MatchWithProfile } from '@/data';

export function AgreementCard({ match }: { match: MatchWithProfile }) {
  if (match.mode !== 'par') return null;
  return <ParAgreementCard match={match} />;
}

function ParAgreementCard({ match }: { match: MatchWithProfile }) {
  const theme = useTheme();
  const router = useRouter();
  const { views } = useAgreement(match.id);
  const { compared, different, theirsAhead, total } = summarize(views);

  const headline =
    compared === 0
      ? `${total} temas difíciles, a ciegas hasta que respondáis los dos.`
      : `${compared} de ${total} comparados · ${different} ${different === 1 ? 'distinto' : 'distintos'}`;
  const ahead =
    theirsAhead > 0
      ? `${match.counterpart.name} ha respondido ${theirsAhead} que tú aún no.`
      : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={['Acuerdo de socios', headline, ahead].filter(Boolean).join('. ')}
      onPress={() =>
        router.push({ pathname: '/agreement/[matchId]', params: { matchId: match.id } })
      }
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: theme.border,
          backgroundColor: theme.backgroundElement,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <ThemedText type="bodyStrong">Acuerdo de socios</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {headline}
      </ThemedText>
      {ahead && (
        <ThemedText type="small" style={{ color: theme.brass }}>
          {ahead}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radii.medium, padding: Spacing.three, gap: Spacing.one },
});
