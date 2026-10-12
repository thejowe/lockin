/**
 * Tarjeta de perfil del deck, a pantalla completa como las de Tinder.
 *
 * Presentacional: no sabe nada del gesto ni de la capa de datos. Toda la
 * tarjeta es el «retrato» —no hay fotos en el producto, así que lo pinta el
 * color del avatar con las iniciales en grande— y la información va abajo,
 * sobre un fundido a negro, empezando por el nombre y la edad.
 *
 * Como Tinder con las fotos, la ficha se reparte en páginas que se pasan
 * tocando la mitad derecha (siguiente) o la izquierda (anterior), con las
 * barras de arriba diciendo en cuál estás. El orden de lectura sigue siendo el
 * que decide el swipe (ver `CONCEPTO.md`): primero quién es, qué aporta y qué le
 * falta; luego cuándo trabaja y desde dónde parte; y el prompt al final. Las
 * páginas sustituyen al scroll, que pelearía con el gesto horizontal.
 *
 * Lo que domina y lo que busca van en dos filas etiquetadas y con formas
 * distintas (relleno / hueco, ver `Chip`), porque en una sola lista de chips no
 * hay forma de saber cuál es cuál — y son datos opuestos: confundirlos invierte
 * la lectura del perfil entero.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { FontFamily, Radii, Spacing } from '@/constants/theme';
import {
  DayStrip,
  GithubSeal,
  ambitionLabel,
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

/** Páginas de la ficha, en orden de lectura. El prompt solo si lo hay. */
type Page = 'about' | 'schedule' | 'prompt';

/** Nombre de cada página para el lector de pantalla: dice adónde lleva el toque. */
const PAGE_NAMES: Record<Page, string> = {
  about: 'quién es',
  schedule: 'cuándo trabaja',
  prompt: 'su respuesta',
};

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
  /**
   * Hueco que dejar abajo para lo que flota encima de la tarjeta (los botones
   * de Pasar/Like del deck). Sin él el texto quedaría debajo de los botones.
   */
  bottomInset = 0,
}: {
  profile: Profile;
  viewerSpecialties?: Specialty[];
  viewerSchedule?: DaySchedule;
  safetyOpen?: boolean;
  onSafetyOpenChange?: (open: boolean) => void;
  onBlocked?: () => void;
  bottomInset?: number;
}) {
  const theme = useTheme();
  const [localSafetyOpen, setLocalSafetyOpen] = useState(false);
  const safetyOpen = controlledSafetyOpen ?? localSafetyOpen;
  const setSafetyOpen = (open: boolean) => {
    setLocalSafetyOpen(open);
    onSafetyOpenChange?.(open);
  };
  const [blocked, setBlocked] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const prompt = profile.prompts[0];
  const complement = complementWith(profile, viewerSpecialties);

  const pages: Page[] = prompt ? ['about', 'schedule', 'prompt'] : ['about', 'schedule'];
  const page = pages[Math.min(pageIndex, pages.length - 1)];
  const hasPrevious = pageIndex > 0;
  const hasNext = pageIndex < pages.length - 1;

  if (blocked)
    return (
      <View style={[styles.card, styles.panel, { backgroundColor: theme.surfaceOpaque }]}>
        <ThemedText type="subtitle">Perfil bloqueado.</ThemedText>
      </View>
    );

  if (safetyOpen)
    return (
      <View style={[styles.card, styles.panel, { backgroundColor: theme.surfaceOpaque }]}>
        <SafetyPanel
          profileId={profile.id}
          name={profile.name}
          anchorReportActions
          onClose={() => setSafetyOpen(false)}
          onBlocked={() => {
            setBlocked(true);
            setSafetyOpen(false);
            onBlocked?.();
          }}
        />
      </View>
    );

  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceOpaque }]}>
      <Portrait profile={profile} />

      {/*
        Las dos mitades de la tarjeta pasan de página, como las fotos en Tinder.
        Debajo de todo lo demás: el botón de opciones y el texto quedan encima.
        Si el dedo arrastra, el gesto del deck cancela el toque.
      */}
      <View style={styles.tapZones}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hasPrevious ? `Ver ${PAGE_NAMES[pages[pageIndex - 1]]}` : 'Inicio'}
          accessibilityState={{ disabled: !hasPrevious }}
          disabled={!hasPrevious}
          onPress={() => setPageIndex(pageIndex - 1)}
          style={styles.tapZone}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hasNext ? `Ver ${PAGE_NAMES[pages[pageIndex + 1]]}` : 'Final'}
          accessibilityState={{ disabled: !hasNext }}
          disabled={!hasNext}
          onPress={() => setPageIndex(pageIndex + 1)}
          style={styles.tapZone}
        />
      </View>

      <View style={styles.top} pointerEvents="box-none">
        <View style={styles.bars} pointerEvents="none">
          {pages.map((entry, index) => (
            <View
              key={entry}
              style={[
                styles.bar,
                { backgroundColor: theme.text },
                index !== pageIndex && styles.barIdle,
              ]}
            />
          ))}
        </View>
        <View style={styles.menu}>
          <SafetyMenuButton name={profile.name} onPress={() => setSafetyOpen(true)} />
        </View>
      </View>

      {/* Solo texto y chips, nada que se pulse: los toques pasan a las mitades de debajo. */}
      <View
        pointerEvents="none"
        style={[styles.info, { paddingBottom: bottomInset + Spacing.four }]}>
        <View style={styles.identity}>
          <ThemedText type="title" numberOfLines={1} style={styles.name}>
            {profile.name}
          </ThemedText>
          <ThemedText type="subtitle" style={styles.age}>
            {profile.age}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {profile.location}
        </ThemedText>

        {page === 'about' ? (
          <View style={styles.section}>
            {complement.length > 0 || profile.githubVerification ? (
              <View style={styles.badges}>
                {complement.length > 0 ? <Chip label="✓ Encajas" tone="match" /> : null}
                {/*
                  Sin sello no se pinta nada: marcar lo no verificado castigaría a
                  las especialidades que no tienen GitHub, y el sello es señal —no
                  filtra el deck, no lo ordena, no condiciona el match.
                */}
                {profile.githubVerification ? (
                  <GithubSeal handle={profile.githubVerification.handle} compact />
                ) : null}
              </View>
            ) : null}

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
        ) : null}

        {page === 'schedule' ? (
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
        ) : null}

        {page === 'prompt' && prompt ? (
          <View style={styles.section}>
            <ThemedText type="caption" themeColor="textSecondary">
              {prompt.question}
            </ThemedText>
            {/* La respuesta es lo que hace que un perfil se lea: en grande, como una cita. */}
            <ThemedText type="subtitle" numberOfLines={5}>
              {prompt.answer}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * El «retrato» que ocupa la tarjeta entera: el color de la persona entrando
 * por arriba, sus iniciales en grande y un fundido a negro abajo para que el
 * texto se lea encima. Es decorado: el nombre ya se lee en el texto.
 */
function Portrait({ profile }: { profile: Profile }) {
  const theme = useTheme();
  const accent = profile.avatar.accent === 'teal' ? theme.teal : theme.brass;
  // Ids únicos por tarjeta: en web los `<defs>` de varias tarjetas comparten documento.
  const tintId = `portrait-tint-${profile.id}`;
  const fadeId = `portrait-fade-${profile.id}`;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={tintId} x1="0" y1="0" x2="0.35" y2="1">
            <Stop offset="0" stopColor={accent} stopOpacity={0.62} />
            <Stop offset="0.75" stopColor={accent} stopOpacity={0.08} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${tintId})`} />
      </Svg>

      <View style={styles.monogramSlot}>
        <ThemedText style={styles.monogram}>{profile.avatar.initials}</ThemedText>
      </View>

      {/* Cada `<Svg>` resuelve sus `url(#…)` dentro de sí mismo en nativo: el
          degradado va definido en el mismo SVG que lo usa. */}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.35" stopColor={theme.background} stopOpacity={0} />
            <Stop offset="0.72" stopColor={theme.background} stopOpacity={0.82} />
            <Stop offset="1" stopColor={theme.background} stopOpacity={0.96} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${fadeId})`} />
      </Svg>
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
      <ThemedText type="caption" themeColor="textSecondary" style={styles.rowLabel}>
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
      <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold" numberOfLines={2}>
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
    borderRadius: Radii.card,
    overflow: 'hidden',
  },
  panel: {
    padding: Spacing.three + Spacing.one,
    gap: Spacing.three,
  },
  monogramSlot: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: '58%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogram: {
    fontFamily: FontFamily.displayBold,
    fontSize: 148,
    lineHeight: 160,
    letterSpacing: -6,
    opacity: 0.9,
  },
  tapZones: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
  },
  tapZone: {
    flex: 1,
  },
  top: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.two,
    gap: Spacing.one,
  },
  bars: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: Radii.pill,
  },
  barIdle: {
    opacity: 0.3,
  },
  menu: {
    alignSelf: 'flex-end',
  },
  info: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    gap: Spacing.one,
    paddingHorizontal: Spacing.three + Spacing.one,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  name: {
    flexShrink: 1,
  },
  age: {
    fontFamily: FontFamily.sans,
  },
  section: {
    gap: Spacing.two + Spacing.half,
    paddingTop: Spacing.two,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
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
});
