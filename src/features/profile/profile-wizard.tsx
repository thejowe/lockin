/**
 * El alta del perfil, de pregunta en pregunta (2026-11-01).
 *
 * Es `ProfileForm` partido en pasos para el onboarding: la edición desde la tab
 * Perfil sigue usando el formulario entero por bloques. Comparten borrador,
 * validación y conversión a `ProfileInput` (`profile-form.tsx`), así que lo que
 * se acepta aquí lo acepta también allí.
 *
 * - Los pasos que `seed` ya contestó en «Sobre ti» (nombre, edad) no
 *   se vuelven a preguntar; sin `seed` (alta con Google o Apple) se preguntan.
 * - Los opcionales (lo que busco, respuestas, enlaces) llevan «Omitir» arriba a
 *   la derecha; omitir vacía lo que hubiera en ese paso.
 * - Lo primero es el idioma de la app (2026-11-03): cambiarlo vuelve a montar
 *   la navegación, así que lo rellenado se pasa al asistente nuevo.
 * - La ubicación es país de la lista + ciudad, y el país fija la zona horaria
 *   (`location-fields.tsx`); si el país tiene varias, se elige una.
 */

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useRepositories } from '@/data';

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
import { PhotoCardPicker, PhotoStatus } from './photo-card-picker';
import { chooseProfilePhoto, PhotoSourceSheet } from './photo-source-sheet';
import { Chip, ChipRow, Field, OptionCard, Slider, TextField } from './controls';
import { BirthDateFields, ageFromBirthDate, birthDateProblem, splitBirthDate } from './birth-date';
import {
  initialDraft,
  toInput,
  toggle,
  validate,
  withCountry,
  type Draft,
  type Errors,
  type ProfileSeed,
} from './profile-form';
import { LocationFields } from './location-fields';
import { LanguagePicker, MasteryPicker, SeekingSpecialtyPicker } from './pickers';
import { WizardScreen } from './wizard';

import type { Profile, ProfileInput } from '@/data';
import { getLocale, setLocalePreference, t, type AppLocale } from '@/i18n';

/** Cada idioma escrito en sí mismo: quien no entiende el actual tiene que encontrar el suyo. */
const APP_LANGUAGES: { value: AppLocale; label: string }[] = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'ca', label: 'Català' },
];

type Snapshot = {
  index: number;
  draft: Draft;
  birth: ReturnType<typeof splitBirthDate>;
  approvedPhotoUri: string | null;
};

/**
 * Cambiar de idioma vuelve a montar la navegación (`_layout.tsx`) y con ella el
 * asistente. Lo rellenado se deja aquí justo antes y el asistente nuevo lo
 * recoge al montarse.
 */
let resumeAfterLocaleChange: Snapshot | null = null;

function stashForLocaleChange(snapshot: Snapshot | null) {
  resumeAfterLocaleChange = snapshot;
}

type StepKey =
  | 'appLanguage'
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
  | 'links'
  | 'photo';

/** Campos del borrador que valida cada paso. */
const STEP_FIELDS: Record<StepKey, (keyof Draft)[]> = {
  appLanguage: [],
  name: ['name'],
  birth: ['age'],
  location: ['country', 'city', 'timezone'],
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
  photo: [],
};

const OPTIONAL: StepKey[] = ['seeking', 'seekingLanguages', 'prompts', 'links'];

function stepsFor(seed: ProfileSeed | null, withPhoto: boolean): StepKey[] {
  // La ubicación se pregunta siempre: un `seed` no trae país.
  const basics: StepKey[] = seed ? ['location'] : ['name', 'birth', 'location'];
  return [
    'appLanguage',
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
    ...(withPhoto ? (['photo'] as const) : []),
  ];
}

export function ProfileWizard({
  seed = null,
  initial = null,
  submitLabel,
  withPhoto = false,
  extraSteps = 0,
  onSubmit,
}: {
  seed?: ProfileSeed | null;
  initial?: Profile | null;
  submitLabel: string;
  /** Añade al final el paso de foto obligatoria, con revisión al elegirla. */
  withPhoto?: boolean;
  extraSteps?: number;
  /** Guarda. Si lanza, el asistente se queda en el último paso y enseña el error. */
  onSubmit: (input: ProfileInput, photoUri: string | null, total?: number) => Promise<void>;
}) {
  const { profiles } = useRepositories();
  const steps = stepsFor(seed, withPhoto);
  // Se lee sin vaciar: en modo estricto los inicializadores corren dos veces.
  const [restored] = useState(() => resumeAfterLocaleChange);
  useEffect(() => {
    resumeAfterLocaleChange = null;
  }, []);
  const [index, setIndex] = useState(restored?.index ?? 0);
  const [draft, setDraft] = useState<Draft>(() => restored?.draft ?? initialDraft(initial, seed));
  const [birth, setBirth] = useState(() => restored?.birth ?? splitBirthDate(undefined));
  const [approvedPhotoUri, setApprovedPhotoUri] = useState(restored?.approvedPhotoUri ?? null);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const photoInFlight = useRef(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
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

  function validForSave(finalDraft: Draft) {
    // Por si algo del borrador no cuadra y ningún paso lo vio (p. ej. la zona).
    const found = validate(finalDraft);
    const firstBad = steps.find((key) => STEP_FIELDS[key].some((field) => found[field]));
    if (firstBad) {
      setErrors(found);
      setIndex(steps.indexOf(firstBad));
      return false;
    }
    if (Object.values(found).some(Boolean)) {
      setSaveError(t('Hay algo en tu ficha que no cuadra. Revísala desde tu perfil.'));
      return false;
    }
    return true;
  }

  async function finish(finalDraft: Draft) {
    if (!validForSave(finalDraft)) return;
    setSaving(true);
    setSaveError(null);
    try {
      // La ruta solo necesita subir una URI si todavía está pendiente.
      if (extraSteps) await onSubmit(toInput(finalDraft), null, steps.length + extraSteps);
      else await onSubmit(toInput(finalDraft), null);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : t('No se ha podido guardar.'));
    } finally {
      setSaving(false);
    }
  }

  async function choosePhoto(source: 'library' | 'camera') {
    if (photoInFlight.current) return;
    photoInFlight.current = true;
    setPicking(true);
    try {
      const uri = await chooseProfilePhoto(source);
      setPhotoSheetOpen(false);
      if (!uri || !validForSave(draft)) return;

      setPhotoError(null);
      setSaveError(null);
      setApprovedPhotoUri(null);
      setPendingPhotoUri(uri);
      // La revisión necesita un perfil propio. En los reintentos ya existe.
      if (!(await profiles.getCurrent())) await profiles.saveCurrent(toInput(draft));
      await profiles.setAvatarPhoto(uri);
      setApprovedPhotoUri(uri);
    } catch (cause) {
      setPhotoError(
        cause instanceof Error
          ? cause.message
          : t('No se ha podido subir la foto. Inténtalo de nuevo.')
      );
    } finally {
      photoInFlight.current = false;
      setPendingPhotoUri(null);
      setPhotoSheetOpen(false);
      setPicking(false);
    }
  }

  async function handleNext() {
    let current = draft;

    if (step === 'photo' && (!approvedPhotoUri || photoInFlight.current)) {
      setPhotoError(t('Añade una foto de perfil para continuar.'));
      return;
    }

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
    total: steps.length + extraSteps,
    onBack: index > 0 ? () => setIndex(index - 1) : undefined,
    onSkip: optional ? () => void handleSkip() : undefined,
    primaryLabel: last ? (saving ? t('Guardando…') : submitLabel) : t('Continuar'),
    busy: saving || picking,
    error: saveError,
    onPrimary: () => void handleNext(),
  };

  function chooseLanguage(locale: AppLocale) {
    if (locale === getLocale()) {
      // Puede venir de «automático»: se guarda para que no cambie con el del móvil.
      void setLocalePreference(locale);
      return;
    }
    stashForLocaleChange({ index, draft, birth, approvedPhotoUri });
    void setLocalePreference(locale);
  }

  switch (step) {
    case 'appLanguage':
      return (
        <WizardScreen
          {...common}
          title={t('¿En qué idioma quieres usar la app?')}
          subtitle={t('Lo puedes cambiar cuando quieras desde Ajustes.')}>
          <Field label={t('Idioma de la app')}>
            <ChipRow>
              {APP_LANGUAGES.map(({ value, label }) => (
                <Chip
                  key={value}
                  label={label}
                  selected={getLocale() === value}
                  onPress={() => chooseLanguage(value)}
                />
              ))}
            </ChipRow>
          </Field>
        </WizardScreen>
      );

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
          <LocationFields
            value={draft}
            errors={errors}
            onCountryChange={(iso) => {
              setDraft((current) => withCountry(current, iso));
              setErrors({});
            }}
            onCityChange={(value) => update('city', value)}
            onTimezoneChange={(value) => update('timezone', value)}
          />
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

    case 'photo':
      return (
        <WizardScreen
          {...common}
          onBack={picking || saving ? undefined : common.onBack}
          busy={picking || saving || !approvedPhotoUri}
          title={t('Pon tu foto de perfil')}>
          <View style={styles.photo}>
            <PhotoCardPicker
              uri={pendingPhotoUri ?? approvedPhotoUri}
              name={draft.name.trim()}
              age={draft.age}
              disabled={picking || saving}
              onPress={() => setPhotoSheetOpen(true)}
            />
            <PhotoStatus
              message={
                pendingPhotoUri
                  ? t('En revisión…')
                  : approvedPhotoUri
                    ? t('Foto aprobada')
                    : null
              }
            />
            {photoError ? (
              <ThemedText
                type="small"
                themeColor="danger"
                accessibilityRole="alert"
                style={styles.photoMessage}>
                {photoError}
              </ThemedText>
            ) : null}
            <PhotoSourceSheet
              visible={photoSheetOpen}
              onClose={() => {
                if (!photoInFlight.current) setPhotoSheetOpen(false);
              }}
              onChoose={choosePhoto}
              busy={picking}
            />
          </View>
        </WizardScreen>
      );
  }
}

const styles = StyleSheet.create({
  photo: {
    gap: Spacing.two,
  },
  photoMessage: { textAlign: 'center' },
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
