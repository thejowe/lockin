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
  specialtyLabel,
  startingPointSentence,
} from './catalog';
import { ProfileAvatar } from './profile-avatar';

import type { Href } from 'expo-router';

import type { Profile } from '@/data';

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
          Busca
        </ThemedText>
        <ThemedText type="bodyStrong">{modeLabel(profile.lookingFor)}</ThemedText>
      </View>

      <Section title="Especialidades">
        <View style={styles.tags}>
          {profile.specialties.map((specialty) => (
            <View
              key={specialty}
              style={[styles.tag, { backgroundColor: theme.tealSoft, borderColor: theme.border }]}>
              <ThemedText type="smallBold" themeColor="teal">
                {specialtyLabel(specialty)}
              </ThemedText>
            </View>
          ))}
        </View>
      </Section>

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
