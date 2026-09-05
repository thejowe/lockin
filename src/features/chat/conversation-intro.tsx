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
import { MODE_LABELS, SPECIALTY_LABELS, TIME_BAND_LABELS, joinNaturally } from './labels';
import { ProfileAvatar } from './profile-avatar';

import type { MatchWithProfile } from '@/data';

export function ConversationIntro({ match }: { match: MatchWithProfile }) {
  const { counterpart } = match;

  const specialties = joinNaturally(counterpart.specialties.map((s) => SPECIALTY_LABELS[s]));
  const bands = joinNaturally(counterpart.availability.bands.map((b) => TIME_BAND_LABELS[b]));

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
        {counterpart.availability.hoursPerWeek} h/semana · por la {bands}
      </ThemedText>

      <ThemedText type="label" themeColor="brass" style={styles.centered}>
        Match de {MODE_LABELS[match.mode]} · {formatDayHeading(match.createdAt)}
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
