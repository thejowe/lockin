/**
 * La jornada: una regla de 24 horas con las franjas en las que la persona
 * trabaja, a escala (madrugada 00–06, mañana 06–12, tarde 12–20, noche 20–00).
 *
 * Es la firma visual de cofounder: la app va de trabajar a la vez, así que la
 * disponibilidad no se resume en una frase sino que se ve como un día. Si quien
 * mira está en la misma zona horaria, las franjas en las que coincidís salen en
 * verde-azulado (el acento de Lock-In) y además se dicen en texto: el color solo
 * no basta, ni para un lector de pantalla ni para quien no lo distingue.
 *
 * Con zonas horarias distintas no se marca coincidencia: «mañana» en Bogotá y
 * «mañana» en Madrid no son las mismas horas, y prometer un solape que no existe
 * sería peor que no decir nada.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { TIME_BAND_OPTIONS, timeBandLabel } from './catalog';

import type { TimeBand } from '@/data';

/** Horas que ocupa cada franja, en el orden del día. Suman 24. */
const BAND_HOURS: Record<TimeBand, number> = {
  madrugada: 6,
  manana: 6,
  tarde: 8,
  noche: 4,
};

/** Marcas bajo la regla: el inicio de cada franja y el cierre del día. */
const TICKS = [0, 6, 12, 20, 24];

export interface DaySchedule {
  bands: TimeBand[];
  timezone: string;
}

export function DayStrip({
  hoursPerWeek,
  bands,
  timezone,
  viewer,
}: {
  hoursPerWeek: number;
  bands: TimeBand[];
  timezone: string;
  /** Jornada de quien mira. Sin ella (o en otra zona) no se marca coincidencia. */
  viewer?: DaySchedule;
}) {
  const theme = useTheme();
  const shared =
    viewer && viewer.timezone === timezone
      ? bands.filter((band) => viewer.bands.includes(band))
      : [];

  const worked = joinLabels(bands.map(timeBandLabel)) || 'Sin franja';
  const label =
    `Jornada, hora de ${timezoneCity(timezone)}: ${hoursPerWeek} horas por semana, ` +
    `${worked.toLowerCase()}.` +
    (shared.length > 0 ? ` Coincidís ${sharedPhrase(shared)}.` : '');

  return (
    <View accessible accessibilityLabel={label} style={styles.root}>
      <View style={styles.header}>
        <ThemedText type="caption" themeColor="textMuted" numberOfLines={1} style={styles.title}>
          Jornada · hora de {timezoneCity(timezone)}
        </ThemedText>
        <ThemedText type="mono" themeColor="textSecondary">
          {hoursPerWeek} h/sem
        </ThemedText>
      </View>

      <View style={styles.track}>
        {TIME_BAND_OPTIONS.map(({ value }) => {
          const isShared = shared.includes(value);
          const isWorked = bands.includes(value);
          return (
            <View
              key={value}
              style={[
                styles.segment,
                {
                  flex: BAND_HOURS[value],
                  backgroundColor: isShared
                    ? theme.teal
                    : isWorked
                      ? theme.textSecondary
                      : theme.backgroundSelected,
                },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.ticks}>
        {TICKS.map((hour) => (
          <ThemedText
            key={hour}
            type="mono"
            themeColor="textMuted"
            style={[styles.tick, hour === 24 ? styles.tickEnd : { left: `${(hour / 24) * 100}%` }]}>
            {String(hour).padStart(2, '0')}
          </ThemedText>
        ))}
      </View>

      {shared.length > 0 ? (
        <ThemedText type="smallBold" themeColor="teal">
          Coincidís {sharedPhrase(shared)}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** «por la mañana y la tarde», «de madrugada»: como se dice, no como se guarda. */
function sharedPhrase(bands: TimeBand[]): string {
  const parts = bands.map((band) =>
    band === 'madrugada' ? 'de madrugada' : `por la ${timeBandLabel(band).toLowerCase()}`
  );
  return joinLabels(parts);
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
}

/**
 * La zona horaria como se lee: «America/Mexico_City» → «Mexico City».
 */
export function timezoneCity(timezone: string): string {
  return (timezone.split('/').pop() ?? timezone).replace(/_/g, ' ');
}

/** Alto de la regla: se lee de un vistazo sin competir con el texto. */
const TRACK_HEIGHT = 8;
/** Alto de la fila de marcas: una línea de `Typography.mono`. */
const TICKS_HEIGHT = 18;
/** Ancho reservado a cada marca para centrarla bajo su hora. */
const TICK_WIDTH = 20;

const styles = StyleSheet.create({
  root: {
    gap: Spacing.one + Spacing.half,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
  },
  track: {
    flexDirection: 'row',
    height: TRACK_HEIGHT,
    gap: Spacing.half,
  },
  segment: {
    borderRadius: Radii.small / 2,
  },
  ticks: {
    height: TICKS_HEIGHT,
  },
  tick: {
    position: 'absolute',
    width: TICK_WIDTH,
  },
  tickEnd: {
    right: 0,
    textAlign: 'right',
  },
});
