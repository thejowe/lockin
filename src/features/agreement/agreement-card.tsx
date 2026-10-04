/**
 * Entrada al acuerdo de socios desde el chat, debajo de `SessionCard`.
 *
 * Solo en matches Par: en Lock-In devuelve `null`, así el chat la monta sin
 * condición y la regla vive en un solo sitio. No importa nada de
 * `@/features/session`.
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, Stroke } from '@/constants/theme';
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
          backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
          boxShadow: `inset 0px 1px 0px ${theme.glassHighlight}`,
        },
      ]}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
          <Icon name="document" size={18} color={theme.brass} />
        </View>
        <ThemedText type="heading" style={styles.title}>
          Acuerdo de socios
        </ThemedText>
      </View>
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
  card: {
    borderWidth: Stroke.hairline,
    borderRadius: Radii.card,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.half,
    marginBottom: Spacing.one,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: Radii.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
  },
});
