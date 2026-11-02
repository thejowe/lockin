/**
 * La fecha de nacimiento del alta: tres campos (día, mes, año) y las cuentas
 * para sacar la edad, que es lo que guarda el perfil. Se pide dentro del
 * asistente del perfil (`profile-wizard.tsx`).
 */

import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { AGE_MAX, AGE_MIN } from './catalog';
import { Field, TextField } from './controls';
import { t } from '@/i18n';

/** Día, mes y año tal como se teclean (texto). */
export interface BirthParts {
  day: string;
  month: string;
  year: string;
}

/** «AAAA-MM-DD» → partes, o vacías si no hay fecha. */
export function splitBirthDate(value: string | undefined): BirthParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  return match
    ? { year: match[1], month: String(Number(match[2])), day: String(Number(match[3])) }
    : { day: '', month: '', year: '' };
}

function pad(value: string, length: number): string {
  return value.padStart(length, '0');
}

/** Partes → «AAAA-MM-DD». Solo se llama con una fecha ya válida. */
export function joinBirthDate({ day, month, year }: BirthParts): string {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** Años cumplidos a día de `now`, o `null` si la fecha no existe o es futura. */
export function ageFromBirthDate(parts: BirthParts, now: Date = new Date()): number | null {
  const day = Number(parts.day);
  const month = Number(parts.month);
  const year = Number(parts.year);
  if (!parts.day || !parts.month || parts.year.length !== 4) return null;

  const date = new Date(year, month - 1, day);
  const real =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  if (!real || date.getTime() > now.getTime()) return null;

  let age = now.getFullYear() - year;
  const birthdayPassed =
    now.getMonth() > month - 1 || (now.getMonth() === month - 1 && now.getDate() >= day);
  if (!birthdayPassed) age -= 1;
  return age;
}

/** Qué falla en la fecha tecleada, o `null` si vale. */
export function birthDateProblem(parts: BirthParts, now: Date = new Date()): string | null {
  const age = ageFromBirthDate(parts, now);
  if (age === null) return t('Escribe una fecha que exista: día, mes y año.');
  if (age < AGE_MIN || age > AGE_MAX)
    return t('Una edad entre {AGE_MIN} y {AGE_MAX}.', { AGE_MIN, AGE_MAX });
  return null;
}

/** Los tres campos de la fecha de nacimiento, en una fila. */
export function BirthDateFields({
  value,
  onChange,
  error,
}: {
  value: BirthParts;
  onChange: (next: BirthParts) => void;
  error?: string;
}) {
  const digits = (text: string) => text.replace(/[^0-9]/g, '');

  return (
    <Field label={t('Fecha de nacimiento')} hint={t('Solo se enseña tu edad.')} error={error}>
      <View style={styles.dateRow}>
        <View style={styles.dateSmall}>
          <TextField
            value={value.day}
            onChangeText={(text) => onChange({ ...value, day: digits(text) })}
            placeholder={t('Día')}
            inputMode="numeric"
            maxLength={2}
            autoCorrect={false}
            accessibilityLabel={t('Día')}
          />
        </View>
        <View style={styles.dateSmall}>
          <TextField
            value={value.month}
            onChangeText={(text) => onChange({ ...value, month: digits(text) })}
            placeholder={t('Mes')}
            inputMode="numeric"
            maxLength={2}
            autoCorrect={false}
            accessibilityLabel={t('Mes')}
          />
        </View>
        <View style={styles.dateYear}>
          <TextField
            value={value.year}
            onChangeText={(text) => onChange({ ...value, year: digits(text) })}
            placeholder={t('Año')}
            inputMode="numeric"
            maxLength={4}
            autoCorrect={false}
            accessibilityLabel={t('Año')}
          />
        </View>
      </View>
    </Field>
  );
}

const styles = StyleSheet.create({
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  dateSmall: {
    flex: 1,
  },
  dateYear: {
    flex: 1.6,
  },
});
