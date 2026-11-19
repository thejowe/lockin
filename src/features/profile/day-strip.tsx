/** Jornada y coincidencias exactas, en la hora local de quien mira. */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { formatWorkMinute, type WorkRange } from '@/data/work-range';
import { useTheme } from '@/hooks/use-theme';
import { joinList, t } from '@/i18n';

import { projectRanges, sharedPeriods, type DayPeriod, type DaySchedule } from './day-schedule';
import { DayTicks } from './day-ticks';
import { deviceTimezone, zoneLabel } from './locations';

export type { DaySchedule } from './day-schedule';

function rangeText(periods: DayPeriod[]) {
  const ordered = [...periods].sort((a, b) => a[0].startMin - b[0].startMin);
  return joinList(
    ordered.map((period, i) => {
      const phrase = t('De {start} a {end}', {
        start: formatWorkMinute(period[0].startMin),
        end: formatWorkMinute(period[period.length - 1].endMin),
      });
      return i === 0 ? phrase : phrase.toLowerCase();
    })
  );
}

export function DayStrip({
  hoursPerWeek,
  ranges,
  timezone,
  viewer,
}: {
  hoursPerWeek: number;
  ranges: WorkRange[];
  timezone: string;
  viewer?: DaySchedule;
}) {
  const theme = useTheme();
  const now = new Date();
  const localZone = deviceTimezone() ?? viewer?.timezone ?? timezone;
  const projected = projectRanges(ranges, timezone, localZone, now);
  const displayZone = projected ? localZone : timezone;
  const worked = projected ?? ranges.map((range): DayPeriod => [range]);
  const own = viewer ? projectRanges(viewer.ranges, viewer.timezone, displayZone, now) : null;
  const shared = sharedPeriods(worked, own ?? []);
  const workedText = rangeText(worked);
  const when = rangeText(shared).toLowerCase();
  const city = zoneLabel(displayZone);
  const label =
    t('Jornada, hora de {v}: {hoursPerWeek} horas por semana, {v2}.', {
      v: city,
      hoursPerWeek,
      v2: workedText.toLowerCase(),
    }) + (when ? t(' Coincidís {when}.', { when }) : '');

  return (
    <View accessible accessibilityLabel={label} style={styles.root}>
      <View style={styles.header}>
        <ThemedText type="caption" themeColor="textMuted" style={styles.title}>
          {t('Jornada · hora de {city}', { city })}
        </ThemedText>
        <ThemedText type="mono" themeColor="textSecondary">
          {t('{hoursPerWeek} h/sem', { hoursPerWeek })}
        </ThemedText>
      </View>
      <ThemedText type="mono">{workedText}</ThemedText>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <Segments testID="workday-period" ranges={worked.flat()} color={theme.text} />
        <Segments testID="workday-overlap" ranges={shared.flat()} color={theme.teal} />
      </View>
      <DayTicks />
      {when ? (
        <ThemedText type="smallBold" themeColor="teal">
          {t('Coincidís {when}', { when })}
        </ThemedText>
      ) : null}
    </View>
  );
}

function Segments({
  ranges,
  color,
  testID,
}: {
  ranges: WorkRange[];
  color: string;
  testID: string;
}) {
  return ranges.map(({ startMin, endMin }) => (
    <View
      key={startMin}
      testID={testID}
      style={[
        styles.segment,
        {
          left: `${(startMin / 1440) * 100}%`,
          width: `${((endMin - startMin) / 1440) * 100}%`,
          backgroundColor: color,
        },
      ]}
    />
  ));
}

const styles = StyleSheet.create({
  root: { gap: Spacing.one + Spacing.half },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  title: { flex: 1 },
  track: { height: Spacing.two, borderRadius: Radii.pill, overflow: 'hidden' },
  segment: { position: 'absolute', top: 0, bottom: 0 },
});
