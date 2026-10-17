/**
 * «Sobre ti»: el primer paso del alta (desde el 2026-10-17).
 *
 * Nombre, edad y de dónde eres, antes de la cuenta. No se guardan en ningún
 * servidor aquí: van a `signup-draft.ts` y el formulario de perfil, al final del
 * alta, arranca con ellos rellenos. Las reglas son las mismas que las de esos
 * tres campos en `profile-form.tsx`, para que lo que pasa aquí no lo rechace
 * después el formulario largo.
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { OBJECTIONABLE_MESSAGE, isObjectionable } from '@/features/safety/content-filter';

import { AGE_MAX, AGE_MIN } from './catalog';
import { Field, PrimaryButton, SecondaryButton, TextField } from './controls';

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

export function AboutYouForm({
  initial,
  step,
  onNext,
  onBack,
}: {
  initial?: SignupBasics | null;
  /** «Paso 1 de 4», o nada si quien lo monta no cuenta pasos. */
  step?: string;
  onNext: (basics: SignupBasics) => void | Promise<void>;
  onBack?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [age, setAge] = useState(initial ? String(initial.age) : '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  async function handleNext() {
    const found = validateBasics({ name, age, location });
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setSaving(true);
    try {
      await onNext({ name: name.trim(), age: Number(age), location: location.trim() });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {step ? (
          <ThemedText type="label" themeColor="textSecondary">
            {step}
          </ThemedText>
        ) : null}
        <ThemedText type="title">Sobre ti</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          Lo primero, quién eres. Lo verás ya puesto en tu perfil al final.
        </ThemedText>
      </View>

      <Field label="Nombre" error={errors.name}>
        <TextField
          value={name}
          onChangeText={(value) => {
            setName(value);
            setErrors((current) => ({ ...current, name: undefined }));
          }}
          placeholder="Cómo te llamas"
          autoCapitalize="words"
          autoCorrect={false}
          autoComplete="name"
          textContentType="name"
          accessibilityLabel="Nombre"
        />
      </Field>

      <Field label="Edad" error={errors.age}>
        <TextField
          value={age}
          onChangeText={(value) => {
            setAge(value.replace(/[^0-9]/g, ''));
            setErrors((current) => ({ ...current, age: undefined }));
          }}
          placeholder="28"
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="numeric"
          maxLength={2}
          accessibilityLabel="Edad"
        />
      </Field>

      <Field label="¿De dónde eres?" error={errors.location}>
        <TextField
          value={location}
          onChangeText={(value) => {
            setLocation(value);
            setErrors((current) => ({ ...current, location: undefined }));
          }}
          placeholder="Barcelona"
          autoCapitalize="words"
          autoCorrect={false}
          accessibilityLabel="De dónde eres"
        />
      </Field>

      <PrimaryButton
        label={saving ? 'Guardando…' : 'Continuar'}
        disabled={saving}
        onPress={() => void handleNext()}
      />
      {onBack ? <SecondaryButton label="Atrás" onPress={onBack} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.two,
  },
});
