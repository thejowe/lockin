/**
 * «Sobre ti»: el primer paso del alta (desde el 2026-10-17), en tres pantallas
 * desde el 2026-11-01: nombre, fecha de nacimiento y dónde vives.
 *
 * No se guardan en ningún servidor aquí: van a `signup-draft.ts` y el
 * formulario de perfil, al final del alta, arranca con ellos rellenos. Las
 * reglas son las mismas que las de esos campos en el perfil, para que lo que
 * pasa aquí no lo rechace después el formulario largo.
 *
 * Se pide la fecha de nacimiento y se guarda la edad que sale de ella: el
 * perfil, el deck y los filtros trabajan con la edad.
 */

import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { OBJECTIONABLE_MESSAGE, isObjectionable } from '@/features/safety/content-filter';

import { AGE_MAX, AGE_MIN } from './catalog';
import { Field, TextField } from './controls';
import { WizardScreen } from './wizard';

import type { SignupBasics } from './signup-draft';

type Errors = Partial<Record<'name' | 'age' | 'location', string>>;

export function validateBasics(draft: { name: string; age: string; location: string }): Errors {
  const errors: Errors = {};
  const age = Number(draft.age);

  if (draft.name.trim().length < 2) errors.name = 'Escribe tu nombre.';
  if (!Number.isInteger(age) || age < AGE_MIN || age > AGE_MAX) {
    errors.age = `Una edad entre ${AGE_MIN} y ${AGE_MAX}.`;
  }
  if (draft.location.trim().length < 2) errors.location = 'Ciudad o zona donde estás.';

  if (isObjectionable(draft.name)) errors.name = OBJECTIONABLE_MESSAGE;
  if (isObjectionable(draft.location)) errors.location = OBJECTIONABLE_MESSAGE;

  return errors;
}

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
  if (age === null) return 'Escribe una fecha que exista: día, mes y año.';
  if (age < AGE_MIN || age > AGE_MAX) return `Una edad entre ${AGE_MIN} y ${AGE_MAX}.`;
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
    <Field label="Fecha de nacimiento" hint="Solo se enseña tu edad." error={error}>
      <View style={styles.dateRow}>
        <View style={styles.dateSmall}>
          <TextField
            value={value.day}
            onChangeText={(text) => onChange({ ...value, day: digits(text) })}
            placeholder="Día"
            inputMode="numeric"
            maxLength={2}
            autoCorrect={false}
            accessibilityLabel="Día"
          />
        </View>
        <View style={styles.dateSmall}>
          <TextField
            value={value.month}
            onChangeText={(text) => onChange({ ...value, month: digits(text) })}
            placeholder="Mes"
            inputMode="numeric"
            maxLength={2}
            autoCorrect={false}
            accessibilityLabel="Mes"
          />
        </View>
        <View style={styles.dateYear}>
          <TextField
            value={value.year}
            onChangeText={(text) => onChange({ ...value, year: digits(text) })}
            placeholder="Año"
            inputMode="numeric"
            maxLength={4}
            autoCorrect={false}
            accessibilityLabel="Año"
          />
        </View>
      </View>
    </Field>
  );
}

type Step = 'name' | 'birth' | 'location';
const STEPS: Step[] = ['name', 'birth', 'location'];

export function AboutYouForm({
  initial,
  onNext,
  onBack,
  alternatives,
}: {
  /** Otras formas de seguir bajo el primer paso (Google / Apple). */
  alternatives?: ReactNode;
  initial?: SignupBasics | null;
  onNext: (basics: SignupBasics) => void | Promise<void>;
  /** Volver desde el primer paso; los demás pasos vuelven al anterior. */
  onBack?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [name, setName] = useState(initial?.name ?? '');
  const [birth, setBirth] = useState<BirthParts>(() => splitBirthDate(initial?.birthDate));
  const [location, setLocation] = useState(initial?.location ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const step = STEPS[index];

  async function handleNext() {
    if (step === 'name') {
      const found = validateBasics({ name, age: '30', location: 'xx' });
      setErrors({ name: found.name });
      if (found.name) return;
      setIndex(1);
      return;
    }

    if (step === 'birth') {
      const problem = birthDateProblem(birth);
      setErrors({ age: problem ?? undefined });
      if (problem) return;
      setIndex(2);
      return;
    }

    const found = validateBasics({ name, age: '30', location });
    setErrors({ location: found.location });
    if (found.location) return;

    setSaving(true);
    try {
      await onNext({
        name: name.trim(),
        age: ageFromBirthDate(birth) as number,
        location: location.trim(),
        birthDate: joinBirthDate(birth),
      });
    } finally {
      setSaving(false);
    }
  }

  const back = index > 0 ? () => setIndex(index - 1) : onBack;

  if (step === 'name') {
    return (
      <WizardScreen
        step={1}
        total={STEPS.length}
        title="¿Cómo te llamas?"
        subtitle="Es lo primero que verá la gente en tu tarjeta."
        onBack={back}
        primaryLabel="Continuar"
        onPrimary={() => void handleNext()}
        below={alternatives}>
        <Field label="Nombre" error={errors.name}>
          <TextField
            value={name}
            onChangeText={(value) => {
              setName(value);
              setErrors({});
            }}
            placeholder="Cómo te llamas"
            autoCapitalize="words"
            autoCorrect={false}
            autoComplete="name"
            textContentType="name"
            accessibilityLabel="Nombre"
          />
        </Field>
      </WizardScreen>
    );
  }

  if (step === 'birth') {
    return (
      <WizardScreen
        step={2}
        total={STEPS.length}
        title="¿Cuándo naciste?"
        onBack={back}
        primaryLabel="Continuar"
        onPrimary={() => void handleNext()}>
        <BirthDateFields
          value={birth}
          onChange={(next) => {
            setBirth(next);
            setErrors({});
          }}
          error={errors.age}
        />
      </WizardScreen>
    );
  }

  return (
    <WizardScreen
      step={3}
      total={STEPS.length}
      title="¿Dónde vives?"
      subtitle="Ciudad o zona. Sirve para encontrar a gente cerca."
      onBack={back}
      primaryLabel={saving ? 'Guardando…' : 'Continuar'}
      busy={saving}
      onPrimary={() => void handleNext()}>
      <Field label="¿De dónde eres?" error={errors.location}>
        <TextField
          value={location}
          onChangeText={(value) => {
            setLocation(value);
            setErrors({});
          }}
          placeholder="Barcelona"
          autoCapitalize="words"
          autoCorrect={false}
          accessibilityLabel="De dónde eres"
        />
      </Field>
    </WizardScreen>
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
