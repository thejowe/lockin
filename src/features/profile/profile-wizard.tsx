/**
 * El alta del perfil, de pregunta en pregunta (2026-11-01).
 *
 * Es `ProfileForm` partido en pasos para el onboarding: la edición desde la tab
 * Perfil sigue usando el formulario entero por bloques. Comparten borrador,
 * validación y conversión a `ProfileInput` (`profile-form.tsx`), así que lo que
 * se acepta aquí lo acepta también allí.
 *
 * - Los pasos que `seed` ya contestó en «Sobre ti» (nombre, edad, ubicación) no
 *   se vuelven a preguntar; sin `seed` (alta con Google o Apple) se preguntan.
 * - Los opcionales (lo que busco, respuestas, enlaces) llevan «Omitir» arriba a
 *   la derecha; omitir vacía lo que hubiera en ese paso.
 * - La zona horaria se toma del dispositivo y no tiene paso: se corrige después
 *   desde el perfil.
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import {
  AMBITION_OPTIONS,
  HOURS_MAX,
  HOURS_MIN,
  HOURS_STEP,
  PROMPT_MAX_LENGTH,
  PROMPT_QUESTIONS,
  STARTING_POINT_OPTIONS,
  TIME_BAND_OPTIONS,
} from './catalog';
import { Chip, ChipRow, Field, OptionCard, Slider, TextField } from './controls';
import { BirthDateFields, ageFromBirthDate, birthDateProblem, splitBirthDate } from './birth-date';
import {
  initialDraft,
  toInput,
  toggle,
  validate,
  type Draft,
  type Errors,
  type ProfileSeed,
} from './profile-form';
import { LanguagePicker, MasteryPicker, SeekingSpecialtyPicker } from './pickers';
import { WizardScreen } from './wizard';

import type { Profile, ProfileInput } from '@/data';
import { t } from '@/i18n';

type StepKey =
  | 'name'
  | 'birth'
  | 'location'
  | 'specialties'
  | 'seeking'
  | 'languages'
  | 'seekingLanguages'
  | 'startingPoint'
  | 'hours'
  | 'bands'
  | 'ambition'
  | 'prompts'
  | 'links';

/** Campos del borrador que valida cada paso. */
const STEP_FIELDS: Record<StepKey, (keyof Draft)[]> = {
  name: ['name'],
  birth: ['age'],
  location: ['location'],
  specialties: ['specialties'],
  seeking: ['seekingSpecialties'],
  languages: ['languages'],
  seekingLanguages: [],
  startingPoint: ['startingPoint'],
  hours: [],
  bands: ['bands'],
  ambition: ['ambition'],
  prompts: ['prompts'],
  links: ['github'],
};

const OPTIONAL: StepKey[] = ['seeking', 'seekingLanguages', 'prompts', 'links'];

function stepsFor(seed: ProfileSeed | null): StepKey[] {
  const basics: StepKey[] = seed ? [] : ['name', 'birth', 'location'];
  return [
    ...basics,
    'specialties',
    'seeking',
    'languages',
    'seekingLanguages',
    'startingPoint',
    'hours',
    'bands',
    'ambition',
    'prompts',
    'links',
  ];
}

export function ProfileWizard({
  seed = null,
  initial = null,
  submitLabel,
  onSubmit,
}: {
  seed?: ProfileSeed | null;
  initial?: Profile | null;
  submitLabel: string;
  /** Guarda. Si lanza, el asistente se queda en el último paso y enseña el error. */
  onSubmit: (input: ProfileInput) => Promise<void>;
}) {
  const steps = stepsFor(seed);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => initialDraft(initial, seed));
  const [birth, setBirth] = useState(() => splitBirthDate(undefined));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const step = steps[index];
  const last = index === steps.length - 1;
  const optional = OPTIONAL.includes(step);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function updatePrompt(position: number, patch: Partial<Draft['prompts'][number]>) {
    setDraft((current) => ({
      ...current,
      prompts: current.prompts.map((prompt, i) =>
        i === position ? { ...prompt, ...patch } : prompt
      ),
    }));
    setErrors((current) => ({ ...current, prompts: undefined }));
  }

  async function finish(finalDraft: Draft) {
    // Por si algo del borrador no cuadra y ningún paso lo vio (p. ej. la zona).
    const found = validate(finalDraft);
    const firstBad = steps.find((key) => STEP_FIELDS[key].some((field) => found[field]));
    if (firstBad) {
      setErrors(found);
      setIndex(steps.indexOf(firstBad));
      return;
    }
    if (Object.values(found).some(Boolean)) {
      setSaveError(t('Hay algo en tu ficha que no cuadra. Revísala desde tu perfil.'));
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await onSubmit(toInput(finalDraft));
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : t('No se ha podido guardar.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    let current = draft;

    if (step === 'birth') {
      const problem = birthDateProblem(birth);
      if (problem) {
        setErrors({ age: problem });
        return;
      }
      current = { ...draft, age: String(ageFromBirthDate(birth)) };
      setDraft(current);
    } else {
      const found = validate(current);
      const bad = STEP_FIELDS[step].filter((field) => found[field]);
      if (bad.length > 0) {
        setErrors(found);
        return;
      }
    }

    setErrors({});
    if (last) await finish(current);
    else setIndex(index + 1);
  }

  /** Omitir vacía lo del paso y sigue (o termina, si era el último). */
  async function handleSkip() {
    let cleared = draft;
    if (step === 'seeking') cleared = { ...draft, seekingSpecialties: [] };
    if (step === 'seekingLanguages') cleared = { ...draft, seekingLanguages: [] };
    if (step === 'prompts') {
      cleared = { ...draft, prompts: draft.prompts.map((prompt) => ({ ...prompt, answer: '' })) };
    }
    if (step === 'links') {
      cleared = { ...draft, github: '', portfolio: '', linkedin: '', instagram: '', tiktok: '' };
    }
    setDraft(cleared);
    setErrors({});
    if (last) await finish(cleared);
    else setIndex(index + 1);
  }

  const common = {
    step: index + 1,
    total: steps.length,
    onBack: index > 0 ? () => setIndex(index - 1) : undefined,
    onSkip: optional ? () => void handleSkip() : undefined,
    primaryLabel: last ? (saving ? t('Guardando…') : submitLabel) : t('Continuar'),
    busy: saving,
    error: saveError,
    onPrimary: () => void handleNext(),
  };

  switch (step) {
    case 'name':
      return (
        <WizardScreen {...common} title={t('¿Cómo te llamas?')}>
          <Field label={t('Nombre')} error={errors.name}>
            <TextField
              value={draft.name}
              onChangeText={(value) => update('name', value)}
              placeholder={t('Cómo te llamas')}
              autoCapitalize="words"
              autoCorrect={false}
              autoComplete="name"
              accessibilityLabel={t('Nombre')}
            />
          </Field>
        </WizardScreen>
      );

    case 'birth':
      return (
        <WizardScreen {...common} title={t('¿Cuándo naciste?')}>
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

    case 'location':
      return (
        <WizardScreen {...common} title={t('¿Dónde vives?')}>
          <Field label={t('Ubicación')} error={errors.location}>
            <TextField
              value={draft.location}
              onChangeText={(value) => update('location', value)}
              placeholder="Barcelona"
              autoCapitalize="words"
              autoCorrect={false}
              accessibilityLabel={t('Ubicación')}
            />
          </Field>
        </WizardScreen>
      );

    case 'specialties':
      return (
        <WizardScreen
          {...common}
          title={t('¿Qué dominas?')}
          subtitle={t('Lo que sabes hacer. Elige todas las que apliquen.')}>
          <Field label={t('Lo que domino')} error={errors.specialties}>
            <MasteryPicker
              specialties={draft.specialties}
              other={draft.otherSpecialty}
              onSpecialtiesChange={(next) => update('specialties', next)}
              // El error de «Otra» se pinta en `specialties`.
              onOtherChange={(next) => {
                update('otherSpecialty', next);
                setErrors((current) => ({ ...current, specialties: undefined }));
              }}
            />
          </Field>
        </WizardScreen>
      );

    case 'seeking':
      return (
        <WizardScreen
          {...common}
          title={t('¿Qué le pides a tu cofundador?')}
          subtitle={t('Lo que a ti te falta. Si lo omites, te enseñamos a todo el mundo.')}>
          <Field label={t('Lo que debe dominar quien busco')} error={errors.seekingSpecialties}>
            <SeekingSpecialtyPicker
              values={draft.seekingSpecialties}
              onChange={(next) => update('seekingSpecialties', next)}
            />
          </Field>
        </WizardScreen>
      );

    case 'languages':
      return (
        <WizardScreen
          {...common}
          title={t('¿Qué idiomas hablas?')}
          subtitle={t('Elige todos los que manejes con soltura.')}>
          <Field label={t('Idiomas que hablo')} error={errors.languages}>
            <LanguagePicker
              values={draft.languages}
              onChange={(next) => update('languages', next)}
            />
          </Field>
        </WizardScreen>
      );

    case 'seekingLanguages':
      return (
        <WizardScreen
          {...common}
          title={t('¿Qué idiomas debe hablar?')}
          subtitle={t('Los que necesitas que hable tu cofundador. Si lo omites, te da igual.')}>
          <Field label={t('Idiomas que debe hablar quien busco')}>
            <LanguagePicker
              values={draft.seekingLanguages}
              onChange={(next) => update('seekingLanguages', next)}
              seeking
            />
          </Field>
        </WizardScreen>
      );

    case 'startingPoint':
      return (
        <WizardScreen {...common} title={t('¿En qué punto estás?')}>
          <Field label={t('Punto de partida')} error={errors.startingPoint}>
            {STARTING_POINT_OPTIONS.map((option) => (
              <OptionCard
                key={option.value}
                option={option}
                selected={draft.startingPoint === option.value}
                onPress={() => update('startingPoint', option.value)}
              />
            ))}
          </Field>
        </WizardScreen>
      );

    case 'hours':
      return (
        <WizardScreen
          {...common}
          title={t('¿Cuántas horas puedes dedicarle?')}
          subtitle={t('Horas reales, no las que te gustaría tener.')}>
          <View style={styles.hours}>
            <ThemedText type="display" style={styles.hoursValue} accessibilityLiveRegion="polite">
              {draft.hoursPerWeek}
            </ThemedText>
            <ThemedText type="body" themeColor="textSecondary" style={styles.hoursValue}>
              {t('horas por semana')}
            </ThemedText>
            <Slider
              value={draft.hoursPerWeek}
              onChange={(value) => update('hoursPerWeek', value)}
              min={HOURS_MIN}
              max={HOURS_MAX}
              step={HOURS_STEP}
              accessibilityLabel={t('Horas por semana')}
            />
            <View style={styles.hoursRange}>
              <ThemedText type="small" themeColor="textMuted">
                {HOURS_MIN} h
              </ThemedText>
              <ThemedText type="small" themeColor="textMuted">
                {HOURS_MAX} h
              </ThemedText>
            </View>
          </View>
        </WizardScreen>
      );

    case 'bands':
      return (
        <WizardScreen {...common} title={t('¿Cuándo sueles trabajar?')}>
          <Field label={t('Franjas')} error={errors.bands}>
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
        </WizardScreen>
      );

    case 'ambition':
      return (
        <WizardScreen {...common} title={t('¿Cuánto te la juegas?')}>
          <Field label={t('Ambición')} error={errors.ambition}>
            {AMBITION_OPTIONS.map((option) => (
              <OptionCard
                key={option.value}
                option={option}
                selected={draft.ambition === option.value}
                onPress={() => update('ambition', option.value)}
              />
            ))}
          </Field>
        </WizardScreen>
      );

    case 'prompts':
      return (
        <WizardScreen
          {...common}
          title={t('Cuéntanos algo más')}
          subtitle={t('Respuestas cortas: es lo que hace que un perfil se lea.')}>
          <Field label={t('Tus respuestas')} error={errors.prompts}>
            {draft.prompts.map((prompt, position) => (
              <View key={position} style={styles.prompt}>
                <ChipRow>
                  {PROMPT_QUESTIONS.map((question) => (
                    <Chip
                      key={question}
                      label={t(question)}
                      selected={prompt.question === question}
                      onPress={() => updatePrompt(position, { question })}
                    />
                  ))}
                </ChipRow>
                <TextField
                  value={prompt.answer}
                  onChangeText={(answer) => updatePrompt(position, { answer })}
                  placeholder={position === 0 ? t('Tu respuesta') : t('Opcional')}
                  autoCapitalize="sentences"
                  autoCorrect={false}
                  multiline
                  maxLength={PROMPT_MAX_LENGTH}
                  showCount
                  accessibilityLabel={t(prompt.question)}
                />
              </View>
            ))}
          </Field>
        </WizardScreen>
      );

    case 'links':
      return (
        <WizardScreen
          {...common}
          title={t('¿Dónde te encuentran?')}
          subtitle={t(
            'Lo que enseñe qué has hecho: GitHub, portfolio, LinkedIn, Instagram, TikTok.'
          )}>
          <Field label={t('Enlaces y redes')} error={errors.github}>
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
            <TextField
              value={draft.instagram}
              onChangeText={(value) => update('instagram', value)}
              placeholder="https://instagram.com/tuusuario"
              autoCapitalize="none"
              autoCorrect={false}
              inputMode="url"
              accessibilityLabel="Instagram"
            />
            <TextField
              value={draft.tiktok}
              onChangeText={(value) => update('tiktok', value)}
              placeholder="https://tiktok.com/@tuusuario"
              autoCapitalize="none"
              autoCorrect={false}
              inputMode="url"
              accessibilityLabel="TikTok"
            />
          </Field>
        </WizardScreen>
      );
  }
}

const styles = StyleSheet.create({
  hours: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  hoursValue: {
    textAlign: 'center',
  },
  hoursRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  prompt: {
    gap: Spacing.two,
  },
});
