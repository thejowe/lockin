/**
 * Cabecera del hilo: quién es la persona con la que se ha hecho match.
 *
 * Sale una sola vez, arriba del todo de la conversación. Recuerda lo mínimo para
 * escribir un primer mensaje con criterio (a qué se dedica, dónde está, cuánto
 * puede dedicar) sin obligar a salir del chat a mirar su ficha.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { formatDayHeading } from './format';
import { SPECIALTY_LABELS, joinNaturally } from './labels';
import { ProfileAvatar } from './profile-avatar';

import type { MatchWithProfile } from '@/data';
import { t } from '@/i18n';
import { timeBandPhrase } from '@/features/profile/catalog';

export function ConversationIntro({ match }: { match: MatchWithProfile }) {
  const { counterpart } = match;

  const specialties = joinNaturally(counterpart.specialties.map((s) => SPECIALTY_LABELS[s]));
  const bands = joinNaturally(counterpart.availability.bands.map(timeBandPhrase));

  return (
    <View style={styles.root}>
      <ProfileAvatar avatar={counterpart.avatar} size={72} />

      <ThemedText type="subtitle" style={styles.centered}>
        {counterpart.name}
      </ThemedText>

      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
        {specialties} · {counterpart.location}
      </ThemedText>

      <ThemedText type="mono" themeColor="textMuted" style={styles.centered}>
        {t('{hoursPerWeek} h/semana · {bands}', {
          hoursPerWeek: counterpart.availability.hoursPerWeek,
          bands,
        })}
      </ThemedText>

      <ThemedText type="label" themeColor="textSecondary" style={styles.centered}>
        {t('Match · {date}', { date: formatDayHeading(match.createdAt) })}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
  centered: {
    textAlign: 'center',
  },
});
