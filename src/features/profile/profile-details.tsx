/**
 * Ficha de perfil en modo lectura.
 *
 * Es lo que ve el usuario de su propio perfil en la tab Perfil. Recibe un
 * `Profile` ya resuelto: no consulta repositorios ni sabe de navegación, así que
 * `descubrir` puede reutilizarla para el detalle de una tarjeta si le sirve.
 */

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import {
  ambitionLabel,
  modeLabel,
  seeksComplement,
  specialtyLabel,
  startingPointSentence,
} from './catalog';
import { DayStrip } from './day-strip';
import { GithubSeal } from './github-seal';
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
          {/* La zona horaria la nombra la jornada, más abajo: aquí sobraba. */}
          <View style={[styles.mode, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold">Quiere: {modeLabel(profile.lookingFor)}</ThemedText>
          </View>
        </View>
      </View>

      {/*
        Los dos lados de la complementariedad, uno encima del otro y con
        formas distintas: relleno lo que aporta, hueco lo que le falta.
        Separarlos así es lo único que evita leer una sola lista de tags y no
        saber cuál es cuál.
      */}
      <View
        style={[
          styles.complement,
          styles.tile,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
            boxShadow: `inset 0px 1px 0px ${theme.glassHighlight}`,
          },
        ]}>
        <View style={styles.complementSide}>
          <ThemedText type="label" themeColor="textSecondary">
            Lo que domina
          </ThemedText>
          <SpecialtyTags values={profile.specialties} tone="have" />
        </View>

        {seeksComplement(profile.lookingFor) ? (
          <View
            style={[
              styles.complementSide,
              styles.complementSeeking,
              { borderTopColor: theme.border },
            ]}>
            <ThemedText type="label" themeColor="textSecondary">
              Lo que busca
            </ThemedText>

            {profile.seekingSpecialties.length > 0 ? (
              <SpecialtyTags values={profile.seekingSpecialties} tone="seek" />
            ) : (
              // Vacío no es un dato que falte: es «ábreme a cualquiera».
              <ThemedText type="small" themeColor="textSecondary">
                Abierto a cualquier especialidad.
              </ThemedText>
            )}
          </View>
        ) : null}
      </View>

      {/*
        Cómo trabaja, en un solo bloque con trazos entre datos (la lista
        agrupada de iOS): tres baldosas seguidas pesaban lo mismo que todo lo
        demás y partían la lectura.
      */}
      <View
        style={[
          styles.tile,
          styles.group,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
            boxShadow: `inset 0px 1px 0px ${theme.glassHighlight}`,
          },
        ]}>
        <Section title="Punto de partida" bare>
          <ThemedText type="body">{startingPointSentence(profile.startingPoint)}</ThemedText>
        </Section>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <DayStrip
          hoursPerWeek={profile.availability.hoursPerWeek}
          bands={profile.availability.bands}
          timezone={profile.timezone}
        />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Section title="Ambición" bare>
          <ThemedText type="bodyStrong">{ambitionLabel(profile.ambition)}</ThemedText>
        </Section>
      </View>

      {profile.prompts.map((prompt) => (
        <View
          key={prompt.question}
          style={[
            styles.promptCard,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              boxShadow: `inset 0px 1px 0px ${theme.glassHighlight}`,
            },
          ]}>
          <ThemedText type="small" themeColor="textSecondary">
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

          {/*
            Junto al enlace y no junto al nombre: lo que está verificado es el
            enlace, y ponerlo arriba lo convertiría en «perfil verificado», que
            es justo lo que este sello no dice.
          */}
          {profile.githubVerification ? (
            <GithubSeal handle={profile.githubVerification.handle} />
          ) : null}
        </Section>
      ) : null}
    </View>
  );
}

/**
 * Lista de especialidades en tags. La forma es lo que las separa de un vistazo,
 * igual que en la tarjeta del deck: relleno (`have`) lo que la persona aporta,
 * solo contorno (`seek`) el hueco que busca llenar.
 */
function SpecialtyTags({ values, tone }: { values: Specialty[]; tone: 'have' | 'seek' }) {
  const theme = useTheme();
  const filled = tone === 'have';

  return (
    <View style={styles.tags}>
      {values.map((specialty) => (
        <View
          key={specialty}
          style={[
            styles.tag,
            filled
              ? { backgroundColor: theme.backgroundSelected, borderColor: 'transparent' }
              : { backgroundColor: 'transparent', borderColor: theme.border },
          ]}>
          <ThemedText type="smallBold">{specialtyLabel(specialty)}</ThemedText>
        </View>
      ))}
    </View>
  );
}

/** Baldosa de cristal con su título pequeño arriba, como los paneles de la referencia. */
function Section({
  title,
  children,
  style,
  bare = false,
}: {
  title: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Sin baldosa propia: va dentro de un bloque agrupado que ya la pone. */
  bare?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.section,
        !bare && styles.tile,
        !bare && {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          boxShadow: `inset 0px 1px 0px ${theme.glassHighlight}`,
        },
        style,
      ]}>
      <ThemedText type="small" themeColor="textSecondary">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.two + Spacing.half,
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
  mode: {
    alignSelf: 'flex-start',
    marginTop: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two + Spacing.half,
    borderRadius: Radii.pill,
  },
  group: {
    gap: Spacing.three,
  },
  divider: {
    height: Stroke.hairline,
  },
  section: {
    gap: Spacing.one,
  },
  tile: {
    padding: Spacing.three,
    borderRadius: Radii.large,
    borderWidth: Stroke.hairline,
  },
  complement: {
    gap: Spacing.three,
  },
  complementSide: {
    gap: Spacing.two,
  },
  complementSeeking: {
    paddingTop: Spacing.three,
    borderTopWidth: Stroke.hairline,
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
    borderWidth: Stroke.thin,
  },
  promptCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.large,
    borderWidth: Stroke.hairline,
  },
});
