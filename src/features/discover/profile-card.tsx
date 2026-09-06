/**
 * Tarjeta de perfil del deck.
 *
 * Presentacional: no sabe nada del gesto ni de la capa de datos. El orden de
 * lectura es deliberado — primero quién es, luego qué busca y con qué encaje, y
 * el prompt al final: es lo que decide el swipe (ver `CONCEPTO.md`).
 *
 * Es una versión compacta y de altura fija a propósito. La ficha larga
 * (`ProfileDetails` de `perfil`) se lee con scroll, y aquí el scroll pelearía
 * con el gesto horizontal.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import {
  ProfileAvatar,
  ambitionLabel,
  availabilitySummary,
  modeLabel,
  specialtyLabel,
  startingPointLabel,
} from '@/features/profile';
import { useTheme } from '@/hooks/use-theme';

import { Chip } from './chip';

import type { Profile } from '@/data';

export function ProfileCard({ profile }: { profile: Profile }) {
  const theme = useTheme();
  const prompt = profile.prompts[0];

  return (
    <View
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.header}>
        <ProfileAvatar avatar={profile.avatar} />

        <View style={styles.identity}>
          <ThemedText type="subtitle" numberOfLines={1}>
            {profile.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {profile.age} · {profile.location}
          </ThemedText>
        </View>
      </View>

      <View style={styles.chips}>
        <Chip label={`Busca: ${modeLabel(profile.lookingFor)}`} tone="teal" />
        {profile.specialties.map((specialty) => (
          <Chip key={specialty} label={specialtyLabel(specialty)} />
        ))}
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <View style={styles.facts}>
        <Fact label="Punto de partida" value={startingPointLabel(profile.startingPoint)} />
        <Fact label="Ambición" value={ambitionLabel(profile.ambition)} />
        <Fact
          label="Disponibilidad"
          value={availabilitySummary(profile.availability.hoursPerWeek, profile.availability.bands)}
        />
        <Fact label="Zona horaria" value={profile.timezone} />
      </View>

      {prompt ? (
        <View style={[styles.prompt, { borderColor: theme.border }]}>
          <ThemedText type="label" themeColor="brass">
            {prompt.question}
          </ThemedText>
          <ThemedText type="body" numberOfLines={4}>
            {prompt.answer}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

/** Fila de dato: etiqueta en versales y valor en mono. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <ThemedText type="label" themeColor="textMuted" style={styles.factLabel}>
        {label}
      </ThemedText>
      <ThemedText type="mono" themeColor="textSecondary" style={styles.factValue} numberOfLines={2}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  identity: {
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  facts: {
    gap: Spacing.two,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  factLabel: {
    width: 132,
  },
  factValue: {
    flex: 1,
  },
  prompt: {
    marginTop: 'auto',
    gap: Spacing.one,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
