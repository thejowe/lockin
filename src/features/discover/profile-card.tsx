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
import { Radii, Spacing } from '@/constants/theme';
import {
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
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      <View style={styles.header}>
        <ProfileAvatar avatar={profile.avatar} />

        <View style={styles.identity}>
          <ThemedText type="subtitle" numberOfLines={1}>
            {profile.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {profile.age} · {profile.location}
          </ThemedText>

          <View style={styles.headerChips}>
            <Chip label={`Quiere: ${modeLabel(profile.lookingFor)}`} />
            {complement.length > 0 ? <Chip label="✓ Encajas" tone="match" /> : null}
          </View>
        </View>
      </View>

      <View style={styles.complement}>
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

/** Etiqueta en versales a la izquierda y contenido que envuelve a la derecha. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <ThemedText type="label" themeColor="textMuted" style={styles.rowLabel}>
        {label}
      </ThemedText>
      <View style={styles.rowContent}>{children}</View>
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
    gap: Spacing.half,
  },
  headerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.half,
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
    width: 64,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.one,
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
