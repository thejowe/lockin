/**
 * Tarjeta de perfil del deck.
 *
 * Presentacional: no sabe nada del gesto ni de la capa de datos. El orden de
 * lectura es deliberado — primero quién es, luego qué aporta y qué le falta,
 * cuándo trabaja, y el prompt al final: es lo que decide el swipe (ver
 * `CONCEPTO.md`).
 *
 * Una sola superficie, sin baldosas dentro: las secciones se separan con un
 * trazo fino y con la tipografía, no con cajas de cristal anidadas. Cuando todo
 * va en su propia caja, todo pesa igual y nada guía la lectura.
 *
 * Lo que domina y lo que busca van en dos filas etiquetadas y con formas
 * distintas (relleno / hueco, ver `Chip`), porque en una sola lista de chips no
 * hay forma de saber cuál es cuál — y son datos opuestos: confundirlos invierte
 * la lectura del perfil entero.
 *
 * Es una versión compacta y de altura fija a propósito. La ficha larga
 * (`ProfileDetails` de `perfil`) se lee con scroll, y aquí el scroll pelearía
 * con el gesto horizontal.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, Stroke } from '@/constants/theme';
import {
  DayStrip,
  GithubSeal,
  ProfileAvatar,
  ambitionLabel,
  modeLabel,
  seeksComplement,
  specialtyLabel,
  startingPointLabel,
  type DaySchedule,
} from '@/features/profile';
import { useTheme } from '@/hooks/use-theme';
import { SafetyMenuButton, SafetyPanel } from '@/features/safety/safety-panel';

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
  /** Jornada de quien swipea: marca en qué franjas coincidís. Igual de opcional. */
  viewerSchedule,
  /**
   * El panel de seguridad abierto, controlado desde fuera. El deck lo sube para
   * apagar el gesto y los botones de Like/Pass mientras el formulario está
   * abierto: si no, un toque sobre «Me gusta» perdería el motivo y el detalle
   * sin enviarlos. Sin esta prop la tarjeta lo lleva ella sola.
   */
  safetyOpen: controlledSafetyOpen,
  onSafetyOpenChange,
  /** Se llama tras bloquear con éxito: el deck pasa a la siguiente tarjeta. */
  onBlocked,
}: {
  profile: Profile;
  viewerSpecialties?: Specialty[];
  viewerSchedule?: DaySchedule;
  safetyOpen?: boolean;
  onSafetyOpenChange?: (open: boolean) => void;
  onBlocked?: () => void;
}) {
  const theme = useTheme();
  const [localSafetyOpen, setLocalSafetyOpen] = useState(false);
  const safetyOpen = controlledSafetyOpen ?? localSafetyOpen;
  const setSafetyOpen = (open: boolean) => {
    setLocalSafetyOpen(open);
    onSafetyOpenChange?.(open);
  };
  const [blocked, setBlocked] = useState(false);
  const prompt = profile.prompts[0];
  const complement = complementWith(profile, viewerSpecialties);
  const divider = [styles.divider, { backgroundColor: theme.border }];

  if (blocked)
    return (
      <View
        style={[styles.card, { backgroundColor: theme.surfaceOpaque, borderColor: theme.border }]}>
        <ThemedText type="subtitle">Perfil bloqueado.</ThemedText>
      </View>
    );

  if (safetyOpen)
    return (
      <View
        style={[styles.card, { backgroundColor: theme.surfaceOpaque, borderColor: theme.border }]}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <SafetyPanel
            profileId={profile.id}
            name={profile.name}
            onClose={() => setSafetyOpen(false)}
            onBlocked={() => {
              setBlocked(true);
              setSafetyOpen(false);
              onBlocked?.();
            }}
          />
        </ScrollView>
      </View>
    );

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
          <SafetyMenuButton name={profile.name} onPress={() => setSafetyOpen(true)} />
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

      <View style={divider} />

      <View style={styles.section}>
        <SpecialtyRow label="Domina" values={profile.specialties} tone="have" />

        {seeksComplement(profile.lookingFor) ? (
          profile.seekingSpecialties.length > 0 ? (
            <SpecialtyRow
              label="Busca"
              values={profile.seekingSpecialties}
              tone="seek"
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

      <View style={styles.section}>
        <DayStrip
          hoursPerWeek={profile.availability.hoursPerWeek}
          bands={profile.availability.bands}
          timezone={profile.timezone}
          viewer={viewerSchedule}
        />

        <View style={styles.facts}>
          <Fact label="Punto de partida" value={startingPointLabel(profile.startingPoint)} />
          <Fact label="Ambición" value={ambitionLabel(profile.ambition)} />
        </View>
      </View>

      {prompt ? (
        <>
          <View style={divider} />
          <View style={[styles.section, styles.prompt]}>
            <ThemedText type="caption" themeColor="textMuted">
              {prompt.question}
            </ThemedText>
            {/* La respuesta es lo que hace que un perfil se lea: ocupa el hueco
                que queda, en grande, como la cita de una ficha. */}
            <ThemedText type="subtitle" numberOfLines={4}>
              {prompt.answer}
            </ThemedText>
          </View>
        </>
      ) : null}
    </View>
  );
}

/**
 * Fila de especialidades con su etiqueta al lado.
 *
 * Las de `highlight` salen en brasa y con "✓" delante: el color solo no vale —
 * ni para quien no lo distingue, ni para un lector de pantalla, que de un chip
 * solo lee el texto.
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

/** Dato suelto: etiqueta pequeña arriba, valor debajo. Sin caja. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
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
    gap: Spacing.three,
    padding: Spacing.three + Spacing.one,
    borderRadius: Radii.card,
    borderWidth: Stroke.hairline,
    overflow: 'hidden',
  },
  hero: {
    gap: Spacing.two + Spacing.half,
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
  divider: {
    height: Stroke.hairline,
  },
  section: {
    gap: Spacing.two + Spacing.half,
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
    gap: Spacing.three,
  },
  fact: {
    flex: 1,
    gap: Spacing.half,
  },
  prompt: {
    flex: 1,
    gap: Spacing.two,
    overflow: 'hidden',
  },
});
