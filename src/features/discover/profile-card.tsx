/**
 * Tarjeta de perfil del deck.
 *
 * Presentacional: no sabe nada del gesto ni de la capa de datos. El orden de
 * lectura es deliberado — primero quién es, luego qué aporta y qué le falta, y
 * el prompt al final: es lo que decide el swipe (ver `CONCEPTO.md`).
 *
 * Lo que domina y lo que busca van en dos filas etiquetadas y con acentos
 * distintos (verde-azulado / latón, los mismos que `ProfileDetails`), porque en
 * una sola lista de chips no hay forma de saber cuál es cuál — y son datos
 * opuestos: confundirlos invierte la lectura del perfil entero.
 *
 * Es una versión compacta y de altura fija a propósito. La ficha larga
 * (`ProfileDetails` de `perfil`) se lee con scroll, y aquí el scroll pelearía
 * con el gesto horizontal.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, Stroke, type ThemePalette } from '@/constants/theme';
import {
  GithubSeal,
  ProfileAvatar,
  ambitionLabel,
  availabilitySummary,
  modeLabel,
  seeksComplement,
  specialtyLabel,
  startingPointLabel,
} from '@/features/profile';
import { useTheme } from '@/hooks/use-theme';

import { Chip } from './chip';
import { complementWith } from './complement';

import type { ChipTone } from './chip';

import type { Profile, Specialty } from '@/data';

export function ProfileCard({
  profile,
  /**
   * Lo que domina quien está swipeando. Solo sirve para resaltar el encaje; sin
   * ello la tarjeta se pinta igual, sin señal — que es lo correcto mientras el
   * perfil propio se está cargando.
   */
  viewerSpecialties = [],
}: {
  profile: Profile;
  viewerSpecialties?: Specialty[];
}) {
  const theme = useTheme();
  const prompt = profile.prompts[0];
  const complement = complementWith(profile, viewerSpecialties);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surfaceOpaque,
          borderColor: theme.border,
          boxShadow: `inset 0px 1px 0px ${theme.glassHighlight}`,
        },
      ]}>
      <View style={styles.hero}>
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

        <View style={styles.headerChips}>
          <Chip label={`Quiere: ${modeLabel(profile.lookingFor)}`} />
          {complement.length > 0 ? <Chip label="✓ Encajas" tone="match" /> : null}
          {/*
            Aquí arriba porque es donde se decide el swipe. Sin sello no se
            pinta nada: marcar lo no verificado castigaría a las nueve
            especialidades que no tienen GitHub, y el sello es señal —no
            filtra el deck, no lo ordena, no condiciona el match.
          */}
          {profile.githubVerification ? (
            <GithubSeal handle={profile.githubVerification.handle} compact />
          ) : null}
        </View>
      </View>

      <View style={[styles.tile, styles.complement, tileColors(theme)]}>
        <SpecialtyRow label="Domina" values={profile.specialties} tone="teal" />

        {seeksComplement(profile.lookingFor) ? (
          profile.seekingSpecialties.length > 0 ? (
            <SpecialtyRow
              label="Busca"
              values={profile.seekingSpecialties}
              tone="brass"
              highlight={complement}
            />
          ) : (
            // Vacío no es un dato que falte: es «ábreme a cualquiera».
            <Row label="Busca">
              <ThemedText type="small" themeColor="textSecondary">
                Cualquier especialidad
              </ThemedText>
            </Row>
          )
        ) : null}
      </View>

      <View style={styles.facts}>
        <Fact label="Punto de partida" value={startingPointLabel(profile.startingPoint)} />
        <Fact label="Ambición" value={ambitionLabel(profile.ambition)} />
        <Fact
          label="Disponibilidad"
          value={availabilitySummary(profile.availability.hoursPerWeek, profile.availability.bands)}
        />
        <Fact label="Zona horaria" value={timezoneCity(profile.timezone)} />
      </View>

      {prompt ? (
        <View style={[styles.tile, styles.prompt, tileColors(theme)]}>
          <ThemedText type="caption" themeColor="textMuted">
            {prompt.question}
          </ThemedText>
          {/* La respuesta es lo que hace que un perfil se lea: ocupa el hueco que
              queda, en grande, como la cita de una ficha. */}
          <ThemedText type="subtitle" numberOfLines={4}>
            {prompt.answer}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

/**
 * La zona horaria como se lee: «America/Mexico_City» → «Mexico City». La región
 * sobra en una baldosa estrecha, y el guion bajo partía la línea a media palabra.
 */
function timezoneCity(timezone: string): string {
  return (timezone.split('/').pop() ?? timezone).replace(/_/g, ' ');
}

/** Cristal interior: una capa de vidrio sobre la tarjeta opaca. */
function tileColors(theme: ThemePalette) {
  return { backgroundColor: theme.backgroundElement, borderColor: theme.border };
}

/**
 * Fila de especialidades con su etiqueta al lado.
 *
 * Las de `highlight` salen en latón sólido y con "✓" delante: el color solo no
 * vale — ni para quien no distingue latón de latón suave, ni para un lector de
 * pantalla, que de un chip solo lee el texto.
 */
function SpecialtyRow({
  label,
  values,
  tone,
  highlight = [],
}: {
  label: string;
  values: Specialty[];
  tone: ChipTone;
  highlight?: Specialty[];
}) {
  return (
    <Row label={label}>
      {values.map((specialty) => {
        const matched = highlight.includes(specialty);
        return (
          <Chip
            key={specialty}
            label={matched ? `✓ ${specialtyLabel(specialty)}` : specialtyLabel(specialty)}
            tone={matched ? 'match' : tone}
          />
        );
      })}
    </Row>
  );
}

/** Etiqueta pequeña a la izquierda y contenido que envuelve a la derecha. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <ThemedText type="caption" themeColor="textMuted" style={styles.rowLabel}>
        {label}
      </ThemedText>
      <View style={styles.rowContent}>{children}</View>
    </View>
  );
}

/** Dato en su propia baldosa de cristal: etiqueta pequeña arriba, valor debajo. */
function Fact({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.tile, styles.fact, tileColors(theme)]}>
      <ThemedText type="caption" themeColor="textMuted" numberOfLines={1}>
        {label}
      </ThemedText>
      {/* Una línea: la ficha larga está en el perfil; aquí manda que quepa la tarjeta. */}
      <ThemedText type="smallBold" numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

/** Ancho de la etiqueta de fila: alinea los chips de «Domina» y «Busca». */
const ROW_LABEL_WIDTH = 52;

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: Spacing.two,
    padding: Spacing.two + Spacing.one,
    borderRadius: Radii.card,
    borderWidth: Stroke.hairline,
    overflow: 'hidden',
  },
  hero: {
    gap: Spacing.two + Spacing.half,
    padding: Spacing.two,
    paddingBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  identity: {
    flex: 1,
    gap: Spacing.half,
  },
  headerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
  },
  tile: {
    borderRadius: Radii.large,
    borderWidth: Stroke.hairline,
    paddingVertical: Spacing.two + Spacing.half,
    paddingHorizontal: Spacing.two + Spacing.one,
  },
  complement: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowLabel: {
    width: ROW_LABEL_WIDTH,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.one,
  },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  fact: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: Spacing.half,
  },
  prompt: {
    flex: 1,
    gap: Spacing.two,
    overflow: 'hidden',
  },
});
