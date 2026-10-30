/**
 * Filtros del deck.
 *
 * La especialidad es libre. El resto (horas mínimas, franjas, ambición, punto
 * de partida y zona horaria) son de Premium: sin él se ven con candado, tocarlos
 * no cambia el filtro y avisa con `onLocked` (la pantalla abre el paywall).
 *
 * Las opciones y sus textos salen de `features/profile/catalog.ts`: no hay
 * catálogos duplicados aquí. El componente solo pinta; el filtro vive en la
 * pantalla.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { HitSlop, Opacity, Radii, Spacing } from '@/constants/theme';
import {
  AMBITION_OPTIONS,
  HOURS_MAX,
  SPECIALTY_OPTIONS,
  STARTING_POINT_OPTIONS,
  TIME_BAND_OPTIONS,
} from '@/features/profile';
import { useTheme } from '@/hooks/use-theme';

import { Chip } from './chip';

import type { ProfileFilter } from '@/data';
import type { Option } from '@/features/profile';

/** Paso de las horas mínimas y tope de la diferencia horaria (0–12 h). */
const HOURS_STEP = 5;
const ZONE_MAX = 12;

/** Las claves de `ProfileFilter` que exigen Premium. */
const PREMIUM_KEYS = [
  'minHoursPerWeek',
  'timeBands',
  'ambition',
  'startingPoint',
  'timezoneWindowHours',
] as const satisfies readonly (keyof ProfileFilter)[];

/** ¿Lleva el filtro algo que solo Premium puede pedir? */
export function hasPremiumFilters(filter: ProfileFilter): boolean {
  return PREMIUM_KEYS.some((key) => filter[key] !== undefined);
}

/** El mismo filtro sin lo de Premium. */
export function withoutPremiumFilters(filter: ProfileFilter): ProfileFilter {
  const next = { ...filter };
  for (const key of PREMIUM_KEYS) delete next[key];
  return next;
}

/** Quita las claves vacías: `[]` y `undefined` significan «sin filtro». */
function tidy(filter: ProfileFilter): ProfileFilter {
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(filter)) {
    if (entry === undefined || (Array.isArray(entry) && entry.length === 0)) continue;
    next[key] = entry;
  }
  return next as ProfileFilter;
}

function toggled<T>(list: T[] | undefined, item: T): T[] {
  const current = list ?? [];
  return current.includes(item) ? current.filter((other) => other !== item) : [...current, item];
}

export function DeckFilters({
  value,
  isPremium,
  onChange,
  onLocked,
}: {
  value: ProfileFilter;
  isPremium: boolean;
  onChange: (filter: ProfileFilter) => void;
  /** Se tocó un filtro de Premium sin tenerlo. */
  onLocked: () => void;
}) {
  const update = (patch: ProfileFilter) => onChange(tidy({ ...value, ...patch }));
  /** Un cambio de Premium: sin Premium solo avisa. */
  const premium = (patch: ProfileFilter) => (isPremium ? update(patch) : onLocked());
  const clearable = Object.keys(tidy(value)).length > 0;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <ThemedText type="subtitle">Filtros</ThemedText>
        {clearable ? (
          <Pressable accessibilityRole="button" hitSlop={HitSlop.chip} onPress={() => onChange({})}>
            <ThemedText type="smallBold" themeColor="brass">
              Limpiar
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      <Section title="Especialidad">
        <Choices
          options={SPECIALTY_OPTIONS}
          selected={value.specialties}
          onToggle={(item) => update({ specialties: toggled(value.specialties, item) })}
        />
      </Section>

      <Section title="Horas mínimas por semana" locked={!isPremium}>
        <Counter
          noun="horas mínimas"
          value={value.minHoursPerWeek}
          step={HOURS_STEP}
          min={HOURS_STEP}
          max={HOURS_MAX}
          anyLabel="Sin mínimo"
          format={(hours) => `${hours} h/semana`}
          onChange={(next) => premium({ minHoursPerWeek: next })}
        />
      </Section>

      <Section title="Franjas" locked={!isPremium}>
        <Choices
          options={TIME_BAND_OPTIONS}
          selected={value.timeBands}
          onToggle={(item) => premium({ timeBands: toggled(value.timeBands, item) })}
        />
      </Section>

      <Section title="Ambición" locked={!isPremium}>
        <Choices
          options={AMBITION_OPTIONS}
          selected={value.ambition}
          onToggle={(item) => premium({ ambition: toggled(value.ambition, item) })}
        />
      </Section>

      <Section title="Punto de partida" locked={!isPremium}>
        <Choices
          options={STARTING_POINT_OPTIONS}
          selected={value.startingPoint}
          onToggle={(item) => premium({ startingPoint: toggled(value.startingPoint, item) })}
        />
      </Section>

      <Section title="Zona horaria" locked={!isPremium}>
        <Counter
          noun="diferencia horaria"
          value={value.timezoneWindowHours}
          step={1}
          min={0}
          max={ZONE_MAX}
          anyLabel="Cualquiera"
          format={(hours) => `Hasta ${hours} h`}
          onChange={(next) => premium({ timezoneWindowHours: next })}
        />
      </Section>
    </View>
  );
}

function Section({
  title,
  locked = false,
  children,
}: {
  title: string;
  locked?: boolean;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitle}>
        <ThemedText type="smallBold">{title}</ThemedText>
        {locked ? (
          <View accessible accessibilityLabel="Solo con Premium">
            <Icon name="lock" size={14} color={theme.textSecondary} />
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Choices<T extends string>({
  options,
  selected,
  onToggle,
}: {
  options: Option<T>[];
  selected: T[] | undefined;
  onToggle: (value: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const on = selected?.includes(option.value) ?? false;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={option.label}
            hitSlop={HitSlop.chip}
            onPress={() => onToggle(option.value)}>
            <Chip label={option.label} tone={on ? 'match' : 'seek'} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Número opcional con dos botones: `undefined` es «sin filtro». */
function Counter({
  noun,
  value,
  step,
  min,
  max,
  anyLabel,
  format,
  onChange,
}: {
  noun: string;
  value: number | undefined;
  step: number;
  min: number;
  max: number;
  anyLabel: string;
  format: (value: number) => string;
  onChange: (next: number | undefined) => void;
}) {
  const less = () => onChange(value === undefined || value - step < min ? undefined : value - step);
  const more = () => onChange(value === undefined ? min : Math.min(max, value + step));

  return (
    <View style={styles.counter}>
      <CounterButton
        label="−"
        accessibilityLabel={`Restar ${noun}`}
        disabled={value === undefined}
        onPress={less}
      />
      <ThemedText type="bodyStrong">{value === undefined ? anyLabel : format(value)}</ThemedText>
      <CounterButton
        label="+"
        accessibilityLabel={`Sumar ${noun}`}
        disabled={value !== undefined && value >= max}
        onPress={more}
      />
    </View>
  );
}

function CounterButton({
  label,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.counterButton,
        {
          backgroundColor: theme.backgroundSelected,
          opacity: disabled ? Opacity.disabled : pressed ? Opacity.pressed : 1,
        },
      ]}>
      <ThemedText type="heading" themeColor="brass">
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { gap: Spacing.two },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  counter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  counterButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.pill,
  },
});
