/**
 * Ficha de perfil en modo lectura.
 *
 * Es lo que ve el usuario de su propio perfil en la tab Perfil. Recibe un
 * `Profile` ya resuelto: no consulta repositorios ni sabe de navegación, así que
 * `descubrir` puede reutilizarla para el detalle de una tarjeta si le sirve.
 */

import { StyleSheet, View } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import {
  ambitionLabel,
  availabilitySummary,
  modeLabel,
  seeksComplement,
  specialtyLabel,
  startingPointSentence,
} from './catalog';
import { ProfileAvatar } from './profile-avatar';

import type { Href } from 'expo-router';

import type { Profile, Specialty } from '@/data';

export function ProfileDetails({ profile }: { profile: Profile }) {
  const theme = useTheme();
  const links = [
    { label: 'GitHub', href: profile.links.github },
    { label: 'Portfolio', href: profile.links.portfolio },
    { label: 'LinkedIn', href: profile.links.linkedin },
  ].filter((link): link is { label: string; href: string } => Boolean(link.href));

  return (
    <View style={styles.root}>
      <View style={styles.identity}>
        <ProfileAvatar avatar={profile.avatar} size="large" />

        <View style={styles.identityText}>
          <ThemedText type="title">{profile.name}</ThemedText>
          <ThemedText type="body" themeColor="textSecondary">
            {profile.age} · {profile.location}
          </ThemedText>
          <ThemedText type="mono" themeColor="textMuted">
            {profile.timezone}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.banner, { backgroundColor: theme.brassSoft }]}>
        <ThemedText type="label" themeColor="brass">
          Quiere encontrar
        </ThemedText>
        <ThemedText type="bodyStrong">{modeLabel(profile.lookingFor)}</ThemedText>
      </View>

      {/*
        Los dos lados de la complementariedad, uno encima del otro y en colores
        distintos: verde lo que aporta, latón lo que le falta. Separarlos así es
        lo único que evita leer una sola lista de tags y no saber cuál es cuál.
      */}
      <View style={styles.complement}>
        <View style={styles.complementSide}>
          <ThemedText type="label" themeColor="teal">
            Lo que domina
          </ThemedText>
          <SpecialtyTags values={profile.specialties} tone="teal" />
        </View>

        {seeksComplement(profile.lookingFor) ? (
          <View
            style={[
              styles.complementSide,
              styles.complementSeeking,
              { borderTopColor: theme.border },
            ]}>
            <ThemedText type="label" themeColor="brass">
              Lo que busca
            </ThemedText>

            {profile.seekingSpecialties.length > 0 ? (
              <SpecialtyTags values={profile.seekingSpecialties} tone="brass" />
            ) : (
              // Vacío no es un dato que falte: es «ábreme a cualquiera».
              <ThemedText type="small" themeColor="textSecondary">
                Abierto a cualquier especialidad.
              </ThemedText>
            )}
          </View>
        ) : null}
      </View>

      <Section title="Punto de partida">
        <ThemedText type="body">{startingPointSentence(profile.startingPoint)}</ThemedText>
      </Section>

      <Section title="Disponibilidad">
        <ThemedText type="mono">
          {availabilitySummary(profile.availability.hoursPerWeek, profile.availability.bands)}
        </ThemedText>
      </Section>

      <Section title="Ambición">
        <ThemedText type="body">{ambitionLabel(profile.ambition)}</ThemedText>
      </Section>

      {profile.prompts.map((prompt) => (
        <View
          key={prompt.question}
          style={[
            styles.promptCard,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          <ThemedText type="label" themeColor="textMuted">
            {prompt.question}
          </ThemedText>
          <ThemedText type="subtitle">{prompt.answer}</ThemedText>
        </View>
      ))}

      {links.length > 0 ? (
        <Section title="Enlaces">
          {links.map((link) => (
            <ExternalLink key={link.label} href={link.href as Href & string}>
              <ThemedText type="link" themeColor="brass">
                {link.label}
              </ThemedText>
            </ExternalLink>
          ))}
        </Section>
      ) : null}
    </View>
  );
}

/**
 * Lista de especialidades en tags. El tono es lo que las separa de un vistazo:
 * `teal` para lo que la persona aporta, `brass` para lo que busca.
 */
function SpecialtyTags({ values, tone }: { values: Specialty[]; tone: 'teal' | 'brass' }) {
  const theme = useTheme();
  const backgroundColor = tone === 'teal' ? theme.tealSoft : theme.brassSoft;

  return (
    <View style={styles.tags}>
      {values.map((specialty) => (
        <View key={specialty} style={[styles.tag, { backgroundColor, borderColor: theme.border }]}>
          <ThemedText type="smallBold" themeColor={tone}>
            {specialtyLabel(specialty)}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="label" themeColor="brass">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.four,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  identityText: {
    flex: 1,
    gap: Spacing.half,
  },
  banner: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Radii.medium,
  },
  section: {
    gap: Spacing.two,
  },
  complement: {
    gap: Spacing.three,
  },
  complementSide: {
    gap: Spacing.two,
  },
  complementSeeking: {
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tag: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  promptCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.large,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
