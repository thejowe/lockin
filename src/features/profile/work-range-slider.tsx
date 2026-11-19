import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Control, Radii, Spacing, Stroke } from '@/constants/theme';
import { formatWorkMinute, type WorkRange } from '@/data/work-range';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

import { DayTicks } from './day-ticks';

const DAY = 24 * 60;
const STEP = 30;
const MIN_LENGTH = 60;
const HIT = Control.minTouch;
const THUMB_WIDTH = Spacing.two + Spacing.one;
const KEYS = ['startMin', 'endMin'] as const;
type Handle = (typeof KEYS)[number];

function addSecondRange(first: WorkRange): WorkRange[] {
  const after = DAY - first.endMin;
  if (after >= MIN_LENGTH) {
    const startMin = first.endMin + Math.min(MIN_LENGTH, after - MIN_LENGTH);
    return [first, { startMin, endMin: startMin + MIN_LENGTH }];
  }
  if (first.startMin >= MIN_LENGTH) {
    const endMin = first.startMin - Math.min(MIN_LENGTH, first.startMin - MIN_LENGTH);
    return [first, { startMin: endMin - MIN_LENGTH, endMin }];
  }
  // Si no cabe una hora a ningún lado, divide la última hora del tramo actual.
  // Se conserva exactamente la disponibilidad elegida, incluso en un día completo.
  const split = first.endMin - MIN_LENGTH;
  return [
    { ...first, endMin: split },
    { startMin: split, endMin: first.endMin },
  ];
}

export function WorkRangeEditor({
  value,
  onChange,
}: {
  value: WorkRange[];
  onChange: (ranges: WorkRange[]) => void;
}) {
  const second = value[1];
  return (
    <View style={styles.editor}>
      <WorkRangeSlider
        value={value[0]}
        other={second}
        number={second ? 1 : undefined}
        onChange={(range) => onChange(second ? [range, second] : [range])}
      />
      {second ? (
        <WorkRangeSlider
          value={second}
          other={value[0]}
          number={2}
          onChange={(range) => onChange([value[0], range])}
          onRemove={() => onChange([value[0]])}
        />
      ) : (
        <Button
          compact
          variant="secondary"
          label={t('+ Añadir otro tramo')}
          style={styles.add}
          onPress={() => onChange(addSecondRange(value[0]))}
        />
      )}
    </View>
  );
}

/** El propio dedo mueve la selección. No hay interpolación, inercia ni rebote. */
export function WorkRangeSlider({
  value,
  onChange,
  other,
  number,
  onRemove,
}: {
  value: WorkRange;
  onChange: (range: WorkRange) => void;
  other?: WorkRange;
  number?: 1 | 2;
  onRemove?: () => void;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const travel = Math.max(0, width - 2 * HIT);
  const drag = useRef<{ handle: Handle; x: number; minute: number; last: number } | null>(null);

  function position(handle: Handle) {
    return HIT + (value[handle] / DAY) * travel;
  }

  // Cuando las asas se acercan, sus blancos de 44 puntos se extienden hacia
  // fuera. La reserva a los lados permite hacerlo también en 00:00 y 24:00.
  function targetLeft(handle: Handle) {
    const middle = (position('startMin') + position('endMin')) / 2;
    const centered = position(handle) - HIT / 2;
    return handle === 'startMin' ? Math.min(centered, middle - HIT) : Math.max(centered, middle);
  }

  function nearestHandle(x: number): Handle | null {
    if (travel <= 0) return null;
    return KEYS.find((key) => x >= targetLeft(key) && x <= targetLeft(key) + HIT) ?? null;
  }

  function bounds(handle: Handle) {
    const min = other && other.endMin <= value.startMin ? other.endMin : 0;
    const max = other && value.endMin <= other.startMin ? other.startMin : DAY;
    return handle === 'startMin'
      ? { min, max: value.endMin - MIN_LENGTH }
      : { min: value.startMin + MIN_LENGTH, max };
  }

  function change(handle: Handle, raw: number, previous: number) {
    const { min, max } = bounds(handle);
    const minute = Math.max(min, Math.min(max, Math.round(raw / STEP) * STEP));
    if (minute !== previous) {
      // También detecta la hora atravesada si el sistema agrupa dos eventos de movimiento.
      const hour = minute > previous ? Math.floor : Math.ceil;
      const hoursCrossed = Math.abs(hour(minute / 60) - hour(previous / 60));
      for (let tick = 0; tick < hoursCrossed; tick++) {
        void Haptics.selectionAsync().catch(() => undefined);
      }
      onChange({ ...value, [handle]: minute });
    }
    return minute;
  }

  function move(x: number) {
    const active = drag.current;
    if (active && travel > 0) {
      const raw = active.minute + ((x - active.x) / travel) * DAY;
      active.last = change(active.handle, raw, active.last);
    }
  }

  return (
    <View>
      <View style={styles.header}>
        <ThemedText type="heading" style={[styles.range, onRemove && styles.removableRange]}>
          {t('De {start} a {end}', {
            start: formatWorkMinute(value.startMin),
            end: formatWorkMinute(value.endMin),
          })}
        </ThemedText>
        {onRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Quitar el segundo tramo')}
            onPress={onRemove}
            style={styles.remove}>
            <Icon name="close" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.control} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <View
          style={[
            styles.track,
            { backgroundColor: theme.surfaceOpaque, borderColor: theme.textMuted },
          ]}
        />
        <View
          style={[
            styles.fill,
            {
              backgroundColor: theme.brass,
              left: position('startMin'),
              width: position('endMin') - position('startMin'),
            },
          ]}
        />
        {KEYS.map((handle) => {
          const start = handle === 'startMin';
          const { min, max } = bounds(handle);
          const adjust = (by: number) => change(handle, value[handle] + by, value[handle]);
          return (
            <View
              key={handle}
              accessible
              focusable
              tabIndex={0}
              accessibilityRole="adjustable"
              accessibilityLabel={
                number
                  ? start
                    ? t('Inicio del tramo {n}', { n: number })
                    : t('Fin del tramo {n}', { n: number })
                  : start
                    ? t('Inicio de la jornada')
                    : t('Fin de la jornada')
              }
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={value[handle]}
              aria-valuetext={formatWorkMinute(value[handle])}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={({ nativeEvent }) => {
                if (nativeEvent.actionName === 'increment') adjust(STEP);
                if (nativeEvent.actionName === 'decrement') adjust(-STEP);
              }}
              onKeyDown={(event) => {
                const { key } = event.nativeEvent;
                if (['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].includes(key)) {
                  event.preventDefault();
                  adjust(key === 'ArrowLeft' || key === 'ArrowDown' ? -STEP : STEP);
                }
              }}
              style={[styles.target, { left: targetLeft(handle) }]}>
              <View
                style={[
                  styles.thumb,
                  {
                    left: position(handle) - targetLeft(handle) - THUMB_WIDTH / 2,
                    backgroundColor: theme.brass,
                    borderColor: theme.surfaceOpaque,
                  },
                ]}
              />
            </View>
          );
        })}
        {/* La superficie permanece fija mientras se desplazan las asas. */}
        <View
          accessible={false}
          importantForAccessibility="no"
          testID="work-range-touch"
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={(event) => nearestHandle(event.nativeEvent.locationX) !== null}
          onResponderGrant={(event) => {
            const { locationX, pageX } = event.nativeEvent;
            const handle = nearestHandle(locationX);
            if (handle)
              drag.current = { handle, x: pageX, minute: value[handle], last: value[handle] };
          }}
          onResponderMove={(event) => move(event.nativeEvent.pageX)}
          onResponderTerminationRequest={() => false}
          onResponderRelease={(event) => {
            move(event.nativeEvent.pageX);
            drag.current = null;
          }}
          onResponderTerminate={() => {
            drag.current = null;
          }}
        />
      </View>
      <View style={styles.scale}>
        <DayTicks />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { gap: Spacing.three },
  add: { alignSelf: 'center' },
  header: { minHeight: HIT, justifyContent: 'center' },
  remove: {
    position: 'absolute',
    right: 0,
    height: HIT,
    width: HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removableRange: { marginHorizontal: HIT },
  range: { fontVariant: ['tabular-nums'], textAlign: 'center' },
  control: { height: HIT, justifyContent: 'center' },
  track: {
    height: Spacing.two,
    marginHorizontal: HIT,
    borderRadius: Radii.pill,
    borderWidth: Stroke.thin,
  },
  fill: { position: 'absolute', height: Spacing.two, borderRadius: Radii.pill },
  target: {
    position: 'absolute',
    width: HIT,
    height: HIT,
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    width: THUMB_WIDTH,
    height: Spacing.four,
    borderRadius: Radii.small,
    borderWidth: Stroke.thin,
  },
  scale: { marginHorizontal: HIT },
});
