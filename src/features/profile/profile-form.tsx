/**
 * Formulario de perfil — uno solo para crear y para editar.
 *
 * Lo usan `src/app/(onboarding)/profile-form.tsx` (alta) y
 * `src/app/(tabs)/profile.tsx` (edición). Que sea el mismo componente es
 * deliberado: dos formularios paralelos se desincronizan al primer campo nuevo.
 *
 * El componente no habla con los repositorios: recibe el perfil inicial y
 * devuelve un `ProfileInput` por `onSubmit`. Quien lo monta decide qué hacer
 * con él (guardar, navegar, cerrar la edición).
 *
 * Principio innegociable: nadie contrata a nadie. Aquí no hay sueldo, equity ni
 * rol vacante — eso es Modo Talento (Fase 4), fuera del MVP.
 */

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';

import {
  AGE_MAX,
  AGE_MIN,
  AMBITION_OPTIONS,
  HOURS_MAX,
  HOURS_MIN,
  HOURS_STEP,
  MODE_OPTIONS,
  PROMPT_MAX_LENGTH,
  PROMPT_QUESTIONS,
  SPECIALTY_OPTIONS,
  STARTING_POINT_OPTIONS,
  seeksComplement,
  TIME_BAND_OPTIONS,
} from './catalog';
import {
  Chip,
  ChipRow,
  Field,
  OptionCard,
  PrimaryButton,
  SecondaryButton,
  Stepper,
  TextField,
} from './controls';

import type {
  Ambition,
  ModePreference,
  Profile,
  ProfileInput,
  Specialty,
  StartingPoint,
  TimeBand,
} from '@/data';

/** Estado del formulario. Los números viven como texto mientras se teclean. */
interface Draft {
  name: string;
  age: string;
  location: string;
  timezone: string;
  specialties: Specialty[];
  /** Lo que quiere que domine la otra persona. Vacío = «me da igual». */
  seekingSpecialties: Specialty[];
  lookingFor: ModePreference | null;
  startingPoint: StartingPoint | null;
  hoursPerWeek: number;
  bands: TimeBand[];
  ambition: Ambition | null;
  github: string;
  portfolio: string;
  linkedin: string;
  /** Siempre dos huecos: el primero obligatorio, el segundo opcional. */
  prompts: { question: string; answer: string }[];
}

type Errors = Partial<Record<keyof Draft, string>>;

/** Zona horaria del dispositivo. Si el runtime no la expone, un valor editable. */
function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';
  } catch {
    return 'Europe/Madrid';
  }
}

function initialDraft(profile: Profile | null, defaultLookingFor: ModePreference | null): Draft {
  const prompts = [0, 1].map((index) => ({
    question: profile?.prompts[index]?.question ?? PROMPT_QUESTIONS[index],
    answer: profile?.prompts[index]?.answer ?? '',
  }));

  return {
    name: profile?.name ?? '',
    age: profile ? String(profile.age) : '',
    location: profile?.location ?? '',
    timezone: profile?.timezone ?? deviceTimezone(),
    specialties: profile?.specialties ?? [],
    seekingSpecialties: profile?.seekingSpecialties ?? [],
    lookingFor: profile?.lookingFor ?? defaultLookingFor,
    startingPoint: profile?.startingPoint ?? null,
    hoursPerWeek: profile?.availability.hoursPerWeek ?? 10,
    bands: profile?.availability.bands ?? [],
    ambition: profile?.ambition ?? null,
    github: profile?.links.github ?? '',
    portfolio: profile?.links.portfolio ?? '',
    linkedin: profile?.links.linkedin ?? '',
    prompts,
  };
}

/** Añade o quita un valor de una selección múltiple. */
function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

/**
 * Validación mínima: solo lo que hace que una ficha sea impresentable en el deck.
 * Los enlaces son opcionales, pero si se escriben tienen que parecer una URL.
 */
function validate(draft: Draft): Errors {
  const errors: Errors = {};
  const age = Number(draft.age);

  if (draft.name.trim().length < 2) errors.name = 'Escribe tu nombre.';
  if (!Number.isInteger(age) || age < AGE_MIN || age > AGE_MAX) {
    errors.age = `Una edad entre ${AGE_MIN} y ${AGE_MAX}.`;
  }
  if (draft.location.trim().length < 2) errors.location = 'Ciudad o zona donde estás.';
  if (draft.timezone.trim().length === 0) errors.timezone = 'Necesitamos tu zona horaria.';
  if (draft.specialties.length === 0) errors.specialties = 'Elige al menos una especialidad.';
  if (!draft.lookingFor) errors.lookingFor = 'Dinos qué buscas.';
  if (!draft.startingPoint) errors.startingPoint = 'Elige tu punto de partida.';
  if (draft.bands.length === 0) errors.bands = 'Marca al menos una franja horaria.';
  if (!draft.ambition) errors.ambition = 'Elige tu nivel de compromiso.';
  if (draft.prompts[0].answer.trim().length === 0) {
    errors.prompts = 'Responde al menos a la primera pregunta.';
  }

  const invalidLink = ([draft.github, draft.portfolio, draft.linkedin] as const).some(
    (link) => link.trim().length > 0 && !/^https?:\/\/\S+$/.test(link.trim())
  );
  if (invalidLink) errors.github = 'Los enlaces deben empezar por http:// o https://';

  return errors;
}

/** Convierte el borrador validado en lo que espera el repositorio. */
function toInput(draft: Draft): ProfileInput {
  const link = (value: string) => (value.trim().length > 0 ? value.trim() : undefined);

  return {
    name: draft.name.trim(),
    age: Number(draft.age),
    location: draft.location.trim(),
    timezone: draft.timezone.trim(),
    specialties: draft.specialties,
    // La invariante de `Profile.seekingSpecialties`: un perfil de lock-in lo
    // guarda vacío pase lo que pase, aunque el usuario llegara a marcar chips
    // y luego cambiara de modo.
    seekingSpecialties: seeksComplement(draft.lookingFor) ? draft.seekingSpecialties : [],
    // Validado antes de llegar aquí: `validate` exige las tres elecciones.
    lookingFor: draft.lookingFor as ModePreference,
    startingPoint: draft.startingPoint as StartingPoint,
    availability: { hoursPerWeek: draft.hoursPerWeek, bands: draft.bands },
    ambition: draft.ambition as Ambition,
    links: {
      github: link(draft.github),
      portfolio: link(draft.portfolio),
      linkedin: link(draft.linkedin),
    },
    prompts: draft.prompts
      .filter((prompt) => prompt.answer.trim().length > 0)
      .map((prompt) => ({ question: prompt.question, answer: prompt.answer.trim() })),
  };
}

export interface ProfileFormProps {
  /** Perfil a editar, o `null` para un alta. */
  initial?: Profile | null;
  /** Modo elegido en el onboarding: precarga "qué busco" en un alta. */
  defaultLookingFor?: ModePreference | null;
  submitLabel: string;
  /** Guarda. Si lanza, el formulario enseña el error y no se cierra. */
  onSubmit: (input: ProfileInput) => Promise<void>;
  /** Acción secundaria (cancelar edición). Si falta, no se pinta. */
  onCancel?: () => void;
  cancelLabel?: string;
  /** Cabecera propia de la pantalla que lo monta. */
  header?: React.ReactNode;
}

export function ProfileForm({
  initial = null,
  defaultLookingFor = null,
  submitLabel,
  onSubmit,
  onCancel,
  cancelLabel = 'Cancelar',
  header,
}: ProfileFormProps) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(initial, defaultLookingFor));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /** Cambia un campo y borra su error: reñir mientras se corrige es hostil. */
  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function updatePrompt(index: number, patch: Partial<Draft['prompts'][number]>) {
    setDraft((current) => ({
      ...current,
      prompts: current.prompts.map((prompt, position) =>
        position === index ? { ...prompt, ...patch } : prompt
      ),
    }));
    setErrors((current) => ({ ...current, prompts: undefined }));
  }

  async function handleSubmit() {
    const found = validate(draft);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setSaving(true);
    setSaveError(null);
    try {
      await onSubmit(toInput(draft));
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'No se ha podido guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        {header}

        <Field label="Nombre" error={errors.name}>
          <TextField
            value={draft.name}
            onChangeText={(value) => update('name', value)}
            placeholder="Cómo te llamas"
            autoCapitalize="words"
            autoCorrect={false}
            autoComplete="name"
            accessibilityLabel="Nombre"
          />
        </Field>

        <Field label="Edad" error={errors.age}>
          <TextField
            value={draft.age}
            onChangeText={(value) => update('age', value.replace(/[^0-9]/g, ''))}
            placeholder="28"
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="numeric"
            maxLength={2}
            accessibilityLabel="Edad"
          />
        </Field>

        <Field label="Ubicación" error={errors.location}>
          <TextField
            value={draft.location}
            onChangeText={(value) => update('location', value)}
            placeholder="Barcelona"
            autoCapitalize="words"
            autoCorrect={false}
            accessibilityLabel="Ubicación"
          />
        </Field>

        <Field
          label="Zona horaria"
          hint="La detectamos de tu dispositivo. Cámbiala si no es la tuya."
          error={errors.timezone}>
          <TextField
            value={draft.timezone}
            onChangeText={(value) => update('timezone', value)}
            placeholder="Europe/Madrid"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Zona horaria"
          />
        </Field>

        <Field
          label="Lo que domino"
          hint="Lo que sabes hacer. Elige todas las que apliquen."
          error={errors.specialties}>
          <ChipRow>
            {SPECIALTY_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                multiple
                selected={draft.specialties.includes(option.value)}
                onPress={() => update('specialties', toggle(draft.specialties, option.value))}
              />
            ))}
          </ChipRow>
        </Field>

        <Field label="Qué busco" error={errors.lookingFor}>
          {MODE_OPTIONS.map((option) => (
            <OptionCard
              key={option.value}
              option={option}
              selected={draft.lookingFor === option.value}
              onPress={() => update('lookingFor', option.value)}
            />
          ))}
        </Field>

        {/*
          Solo con `par` o `ambos`: a un compañero de lock-in se le pide franja
          horaria, no skills. Va justo detrás de "Qué busco" porque es la misma
          pregunta afinada, y aparece o desaparece al cambiar de modo.
        */}
        {seeksComplement(draft.lookingFor) ? (
          <Field
            label="Lo que debe dominar quien busco"
            hint="Lo que a ti te falta. Si lo dejas vacío, te enseñamos a todo el mundo.">
            <ChipRow>
              {SPECIALTY_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  // Sin esto, "Desarrollo" nombraría dos chips distintos del
                  // mismo formulario: el que domino y el que busco.
                  accessibilityLabel={`Busco ${option.label}`}
                  multiple
                  selected={draft.seekingSpecialties.includes(option.value)}
                  onPress={() =>
                    update('seekingSpecialties', toggle(draft.seekingSpecialties, option.value))
                  }
                />
              ))}
            </ChipRow>
          </Field>
        ) : null}

        <Field label="Punto de partida" error={errors.startingPoint}>
          {STARTING_POINT_OPTIONS.map((option) => (
            <OptionCard
              key={option.value}
              option={option}
              selected={draft.startingPoint === option.value}
              onPress={() => update('startingPoint', option.value)}
            />
          ))}
        </Field>

        <Field label="Disponibilidad" hint="Horas reales, no las que te gustaría tener.">
          <Stepper
            value={draft.hoursPerWeek}
            onChange={(value) => update('hoursPerWeek', value)}
            min={HOURS_MIN}
            max={HOURS_MAX}
            step={HOURS_STEP}
            formatValue={(value) => `${value} h/semana`}
          />
        </Field>

        <Field label="Cuándo sueles trabajar" error={errors.bands}>
          <ChipRow>
            {TIME_BAND_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={`${option.label} · ${option.description}`}
                multiple
                selected={draft.bands.includes(option.value)}
                onPress={() => update('bands', toggle(draft.bands, option.value))}
              />
            ))}
          </ChipRow>
        </Field>

        <Field label="Ambición" error={errors.ambition}>
          {AMBITION_OPTIONS.map((option) => (
            <OptionCard
              key={option.value}
              option={option}
              selected={draft.ambition === option.value}
              onPress={() => update('ambition', option.value)}
            />
          ))}
        </Field>

        <Field
          label="Tus respuestas"
          hint="La primera es obligatoria. Cortas: es lo que hace que un perfil se lea."
          error={errors.prompts}>
          {draft.prompts.map((prompt, index) => (
            <View key={index} style={styles.prompt}>
              <ChipRow>
                {PROMPT_QUESTIONS.map((question) => (
                  <Chip
                    key={question}
                    label={question}
                    selected={prompt.question === question}
                    onPress={() => updatePrompt(index, { question })}
                  />
                ))}
              </ChipRow>

              {/* Prosa, no un nombre propio: el teclado solo levanta la primera
                  letra y el corrector no entra. Con los defectos de Android la
                  respuesta se guardaba capitalizada palabra por palabra. */}
              <TextField
                value={prompt.answer}
                onChangeText={(answer) => updatePrompt(index, { answer })}
                placeholder={index === 0 ? 'Tu respuesta' : 'Opcional'}
                autoCapitalize="sentences"
                autoCorrect={false}
                multiline
                maxLength={PROMPT_MAX_LENGTH}
                showCount
                accessibilityLabel={prompt.question}
              />
            </View>
          ))}
        </Field>

        <Field
          label="Enlaces (opcional)"
          hint="Lo que enseñe qué has hecho, si tienes algo."
          error={errors.github}>
          <TextField
            value={draft.github}
            onChangeText={(value) => update('github', value)}
            placeholder="https://github.com/tuusuario"
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="url"
            accessibilityLabel="GitHub"
          />
          <TextField
            value={draft.portfolio}
            onChangeText={(value) => update('portfolio', value)}
            placeholder="https://tuportfolio.com"
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="url"
            accessibilityLabel="Portfolio"
          />
          <TextField
            value={draft.linkedin}
            onChangeText={(value) => update('linkedin', value)}
            placeholder="https://linkedin.com/in/tuusuario"
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="url"
            accessibilityLabel="LinkedIn"
          />
        </Field>

        {saveError ? (
          <ThemedText type="small" themeColor="danger">
            {saveError}
          </ThemedText>
        ) : null}

        <View style={styles.actions}>
          <PrimaryButton
            label={saving ? 'Guardando…' : submitLabel}
            disabled={saving}
            onPress={handleSubmit}
          />
          {onCancel ? <SecondaryButton label={cancelLabel} onPress={onCancel} /> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  prompt: {
    gap: Spacing.two,
  },
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
});
