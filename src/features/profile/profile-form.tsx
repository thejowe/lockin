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

import { useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';

import { ThemedText } from '@/components/themed-text';
import { OBJECTIONABLE_MESSAGE, isObjectionable } from '@/features/safety/content-filter';
import { MaxContentWidth, Spacing } from '@/constants/theme';

import {
  AGE_MAX,
  AGE_MIN,
  AMBITION_OPTIONS,
  HOURS_MAX,
  HOURS_MIN,
  HOURS_STEP,
  OTHER_SPECIALTY_MIN_LENGTH,
  PROMPT_MAX_LENGTH,
  PROMPT_QUESTIONS,
  SPECIALTIES_MAX,
  STARTING_POINT_OPTIONS,
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
import { LanguagePicker, MasteryPicker, SeekingSpecialtyPicker } from './pickers';

import type {
  Ambition,
  Language,
  Profile,
  ProfileInput,
  Specialty,
  StartingPoint,
  TimeBand,
} from '@/data';
import { t } from '@/i18n';

/** Estado del formulario. Los números viven como texto mientras se teclean. */
export interface Draft {
  name: string;
  age: string;
  location: string;
  timezone: string;
  specialties: Specialty[];
  /** «Otra» especialidad escrita a mano. `null` = sin marcar; `''` = marcada y por escribir. */
  otherSpecialty: string | null;
  /** Lo que quiere que domine la otra persona. Vacío = «me da igual». */
  seekingSpecialties: Specialty[];
  languages: Language[];
  /** Idiomas que debe hablar la otra persona. Vacío = «me da igual». */
  seekingLanguages: Language[];
  startingPoint: StartingPoint | null;
  hoursPerWeek: number;
  bands: TimeBand[];
  ambition: Ambition | null;
  github: string;
  portfolio: string;
  linkedin: string;
  instagram: string;
  tiktok: string;
  /** Siempre dos huecos: el primero obligatorio, el segundo opcional. */
  prompts: { question: string; answer: string }[];
}

export type Errors = Partial<Record<keyof Draft, string>>;

/** Orden de los campos en pantalla: el primero con error es adonde se lleva a la persona. */
const FIELD_ORDER: (keyof Draft)[] = [
  'name',
  'age',
  'location',
  'timezone',
  'specialties',
  'seekingSpecialties',
  'languages',
  'startingPoint',
  'bands',
  'ambition',
  'prompts',
  'github',
];

/** Aire entre el campo enfocado y el borde del teclado. */
const KEYBOARD_GAP = Spacing.five;

/** Aire por encima del campo al llevarlo a la vista, para que se vea su etiqueta. */
const SCROLL_MARGIN = Spacing.three;

/** Zona horaria del dispositivo. Si el runtime no la expone, un valor editable. */
function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';
  } catch {
    return 'Europe/Madrid';
  }
}

/** Lo que el alta ya sabe antes del formulario (ver `signup-draft.ts`). */
export type ProfileSeed = Pick<Profile, 'name' | 'age' | 'location'>;

export function initialDraft(profile: Profile | null, seed: ProfileSeed | null): Draft {
  const prompts = [0, 1].map((index) => ({
    question: profile?.prompts[index]?.question ?? PROMPT_QUESTIONS[index],
    answer: profile?.prompts[index]?.answer ?? '',
  }));

  return {
    name: profile?.name ?? seed?.name ?? '',
    age: profile ? String(profile.age) : seed ? String(seed.age) : '',
    location: profile?.location ?? seed?.location ?? '',
    timezone: profile?.timezone ?? deviceTimezone(),
    specialties: profile?.specialties ?? [],
    otherSpecialty: profile?.otherSpecialty ?? null,
    seekingSpecialties: profile?.seekingSpecialties ?? [],
    languages: profile?.languages ?? [],
    seekingLanguages: profile?.seekingLanguages ?? [],
    startingPoint: profile?.startingPoint ?? null,
    hoursPerWeek: profile?.availability.hoursPerWeek ?? 10,
    bands: profile?.availability.bands ?? [],
    ambition: profile?.ambition ?? null,
    github: profile?.links.github ?? '',
    portfolio: profile?.links.portfolio ?? '',
    linkedin: profile?.links.linkedin ?? '',
    instagram: profile?.links.instagram ?? '',
    tiktok: profile?.links.tiktok ?? '',
    prompts,
  };
}

/** Añade o quita un valor de una selección múltiple. */
export function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

/**
 * Validación mínima: solo lo que hace que una ficha sea impresentable en el deck.
 * Los enlaces son opcionales, pero si se escriben tienen que parecer una URL.
 */
export function validate(draft: Draft): Errors {
  const errors: Errors = {};
  const age = Number(draft.age);

  if (draft.name.trim().length < 2) errors.name = t('Escribe tu nombre.');
  if (!Number.isInteger(age) || age < AGE_MIN || age > AGE_MAX) {
    errors.age = t('Una edad entre {AGE_MIN} y {AGE_MAX}.', { AGE_MIN, AGE_MAX });
  }
  if (draft.location.trim().length < 2) errors.location = t('Ciudad o zona donde estás.');
  if (draft.timezone.trim().length === 0) errors.timezone = t('Necesitamos tu zona horaria.');
  const other = draft.otherSpecialty?.trim() ?? null;
  if (draft.specialties.length === 0 && other === null) {
    errors.specialties = t('Elige al menos una especialidad.');
  } else if (other !== null && other.length < OTHER_SPECIALTY_MIN_LENGTH) {
    errors.specialties = t('Escribe cuál es la otra, o desmárcala.');
  } else if (draft.specialties.length > SPECIALTIES_MAX) {
    errors.specialties = t('Como mucho {SPECIALTIES_MAX}: quédate con las que más te definen.', {
      SPECIALTIES_MAX,
    });
  }
  if (draft.seekingSpecialties.length > SPECIALTIES_MAX) {
    errors.seekingSpecialties = t('Como mucho {SPECIALTIES_MAX}.', { SPECIALTIES_MAX });
  }
  if (draft.languages.length === 0) errors.languages = t('Elige al menos un idioma.');
  if (!draft.startingPoint) errors.startingPoint = t('Elige tu punto de partida.');
  if (draft.bands.length === 0) errors.bands = t('Marca al menos una franja horaria.');
  if (!draft.ambition) errors.ambition = t('Elige tu nivel de compromiso.');
  // Las respuestas son opcionales desde el 2026-10-30 (decisión del usuario):
  // sin ninguna, la tarjeta del deck se queda en sus dos primeras páginas.

  // Complemento del reporte, no moderación: ver `safety/content-filter.ts`.
  const objectionable = (text: string) => isObjectionable(text);
  if (objectionable(draft.name)) errors.name = t(OBJECTIONABLE_MESSAGE);
  if (objectionable(draft.location)) errors.location = t(OBJECTIONABLE_MESSAGE);
  if (other !== null && objectionable(other)) errors.specialties = t(OBJECTIONABLE_MESSAGE);
  if (draft.prompts.some((prompt) => objectionable(prompt.answer))) {
    errors.prompts = t(OBJECTIONABLE_MESSAGE);
  }

  const invalidLink = (
    [draft.github, draft.portfolio, draft.linkedin, draft.instagram, draft.tiktok] as const
  ).some((link) => link.trim().length > 0 && !/^https?:\/\/\S+$/.test(link.trim()));
  if (invalidLink) errors.github = t('Los enlaces deben empezar por http:// o https://');

  return errors;
}

/** Convierte el borrador validado en lo que espera el repositorio. */
export function toInput(draft: Draft): ProfileInput {
  const link = (value: string) => (value.trim().length > 0 ? value.trim() : undefined);

  return {
    name: draft.name.trim(),
    age: Number(draft.age),
    location: draft.location.trim(),
    timezone: draft.timezone.trim(),
    specialties: draft.specialties,
    otherSpecialty: draft.otherSpecialty?.trim() || null,
    seekingSpecialties: draft.seekingSpecialties,
    languages: draft.languages,
    seekingLanguages: draft.seekingLanguages,
    // Desde el 2026-10-12 el producto es solo buscar cofundador: no se pregunta
    // y todo perfil que se guarda queda en `par`, también los que eran de
    // lock-in o «ambos», para que aparezcan en el único deck que hay.
    lookingFor: 'par',
    startingPoint: draft.startingPoint as StartingPoint,
    availability: { hoursPerWeek: draft.hoursPerWeek, bands: draft.bands },
    ambition: draft.ambition as Ambition,
    links: {
      github: link(draft.github),
      portfolio: link(draft.portfolio),
      linkedin: link(draft.linkedin),
      instagram: link(draft.instagram),
      tiktok: link(draft.tiktok),
    },
    prompts: draft.prompts
      .filter((prompt) => prompt.answer.trim().length > 0)
      .map((prompt) => ({ question: prompt.question, answer: prompt.answer.trim() })),
  };
}

export interface ProfileFormProps {
  /** Perfil a editar, o `null` para un alta. */
  initial?: Profile | null;
  /** Sin `initial`: nombre, edad y ubicación ya recogidos en el alta. */
  seed?: ProfileSeed | null;
  submitLabel: string;
  /** Guarda. Si lanza, el formulario enseña el error y no se cierra. */
  onSubmit: (input: ProfileInput) => Promise<void>;
  /** Acción secundaria (cancelar edición). Si falta, no se pinta. */
  onCancel?: () => void;
  cancelLabel?: string;
  /** Cabecera propia de la pantalla que lo monta. */
  header?: React.ReactNode;
  /**
   * Solo esa parte de la ficha: la hoja que abre el lápiz de cada bloque del
   * perfil (2026-10-30). Lo demás no se pinta, pero viaja intacto en el
   * guardado: el borrador sigue siendo la ficha entera.
   */
  section?: ProfileSection;
}

/** Los bloques de la ficha que se editan por separado. */
export type ProfileSection = 'basics' | 'specialties' | 'work' | 'prompts' | 'links';

/** Qué campos (con error propio) pinta cada bloque. */
const SECTION_FIELDS: Record<ProfileSection, (keyof Draft)[]> = {
  basics: ['name', 'age', 'location'],
  specialties: ['specialties', 'seekingSpecialties', 'languages'],
  work: ['timezone', 'startingPoint', 'bands', 'ambition'],
  prompts: ['prompts'],
  links: ['github'],
};

/** Cómo se llama cada bloque en el aviso de «falta algo en otra parte». */
const SECTION_NAMES: Record<ProfileSection, string> = {
  get basics() {
    return t('Nombre, edad y ubicación');
  },
  get specialties() {
    return t('Lo que dominas');
  },
  get work() {
    return t('Cómo trabajas');
  },
  get prompts() {
    return t('Tus respuestas');
  },
  get links() {
    return t('Enlaces y redes');
  },
};

/**
 * Qué falta fuera del bloque que se edita y en qué lápiz se arregla.
 *
 * Los idiomas llevan su propio texto: los perfiles anteriores al 2026-11-02 no
 * los tienen, y sin explicarlo parecería que la ficha se ha roto sola.
 */
export function elsewhereMessage(field: keyof Draft, error: string): string {
  const owner = (Object.keys(SECTION_FIELDS) as ProfileSection[]).find((part) =>
    SECTION_FIELDS[part].includes(field)
  );
  const where = owner ? `«${SECTION_NAMES[owner]}»` : t('otra parte de tu ficha');
  if (field === 'languages') {
    return t(
      'Ahora los perfiles muestran los idiomas y aún no has elegido los tuyos. Añádelos desde el lápiz de {where} y podrás guardar esto.',
      { where }
    );
  }
  return t('Falta algo en {where}: {error} Corrígelo desde su lápiz y podrás guardar esto.', {
    where,
    error,
  });
}

export function ProfileForm({
  initial = null,
  seed = null,
  submitLabel,
  onSubmit,
  onCancel,
  cancelLabel = t('Cancelar'),
  header,
  section,
}: ProfileFormProps) {
  const show = (part: ProfileSection) => section === undefined || section === part;
  const [draft, setDraft] = useState<Draft>(() => initialDraft(initial, seed));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  /** Posición vertical de cada campo dentro del contenido, rellenada por `onLayout`. */
  const [fieldY] = useState<Partial<Record<keyof Draft, number>>>(() => ({}));

  /** Guarda dónde cae un campo, para poder llevar a la persona hasta él. */
  function track(key: keyof Draft) {
    return (event: LayoutChangeEvent) => {
      fieldY[key] = event.nativeEvent.layout.y;
    };
  }

  /** Con sello, `links.github` deja de ser un campo y pasa a derivarse de la identidad. */
  const githubLocked = Boolean(initial?.githubVerification);

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
    // Editando un solo bloque, un fallo en otro no se puede corregir aquí:
    // se dice, en vez de dejar el botón sin hacer nada.
    const elsewhere = section
      ? FIELD_ORDER.find((key) => found[key] && !SECTION_FIELDS[section].includes(key))
      : undefined;
    if (elsewhere) {
      setSaveError(elsewhereMessage(elsewhere, found[elsewhere] ?? ''));
      return;
    }
    if (Object.values(found).some(Boolean)) {
      // En un formulario largo el error puede quedar fuera de pantalla: sin
      // esto el botón «no hace nada» y hay que buscar qué falta a mano.
      const first = FIELD_ORDER.find((key) => found[key]);
      const y = first ? fieldY[first] : undefined;
      if (y !== undefined) {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - SCROLL_MARGIN), animated: true });
      }
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await onSubmit(toInput(draft));
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : t('No se ha podido guardar.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    // El campo enfocado sube por encima del teclado. `KeyboardAvoidingView` no
    // servía: en Android, con edge-to-edge (obligatorio desde Expo SDK 54), la
    // ventana ya no se redimensiona al abrir el teclado y no se entera (ver la
    // nota de `KeyboardProvider` en `src/app/_layout.tsx`); la mitad baja del
    // formulario quedaba tapada mientras se escribía.
    <View style={styles.root}>
      <KeyboardAwareScrollView
        ref={scrollRef}
        bottomOffset={KEYBOARD_GAP}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        {header}

        {show('basics') ? (
          <>
            <Field label={t('Nombre')} error={errors.name} onLayout={track('name')}>
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

            <Field label={t('Edad')} error={errors.age} onLayout={track('age')}>
              <TextField
                value={draft.age}
                onChangeText={(value) => update('age', value.replace(/[^0-9]/g, ''))}
                placeholder="28"
                autoCapitalize="none"
                autoCorrect={false}
                inputMode="numeric"
                maxLength={2}
                accessibilityLabel={t('Edad')}
              />
            </Field>

            <Field label={t('Ubicación')} error={errors.location} onLayout={track('location')}>
              <TextField
                value={draft.location}
                onChangeText={(value) => update('location', value)}
                placeholder="Barcelona"
                autoCapitalize="words"
                autoCorrect={false}
                accessibilityLabel={t('Ubicación')}
              />
            </Field>
          </>
        ) : null}

        {show('work') ? (
          <Field
            label={t('Zona horaria')}
            hint={t('La detectamos de tu dispositivo. Cámbiala si no es la tuya.')}
            error={errors.timezone}
            onLayout={track('timezone')}>
            <TextField
              value={draft.timezone}
              onChangeText={(value) => update('timezone', value)}
              placeholder="Europe/Madrid"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t('Zona horaria')}
            />
          </Field>
        ) : null}

        {show('specialties') ? (
          <>
            <Field
              label={t('Lo que domino')}
              hint={t('Lo que sabes hacer. Elige todas las que apliquen.')}
              error={errors.specialties}
              onLayout={track('specialties')}>
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

            <Field
              label={t('Lo que debe dominar quien busco')}
              hint={t('Lo que a ti te falta. Si lo dejas vacío, te enseñamos a todo el mundo.')}
              error={errors.seekingSpecialties}
              onLayout={track('seekingSpecialties')}>
              <SeekingSpecialtyPicker
                values={draft.seekingSpecialties}
                onChange={(next) => update('seekingSpecialties', next)}
              />
            </Field>

            <Field
              label={t('Idiomas que hablo')}
              error={errors.languages}
              onLayout={track('languages')}>
              <LanguagePicker
                values={draft.languages}
                onChange={(next) => update('languages', next)}
              />
            </Field>

            <Field
              label={t('Idiomas que debe hablar quien busco')}
              hint={t('Si lo dejas vacío, te da igual el idioma.')}>
              <LanguagePicker
                values={draft.seekingLanguages}
                onChange={(next) => update('seekingLanguages', next)}
                seeking
              />
            </Field>
          </>
        ) : null}

        {show('work') ? (
          <>
            <Field
              label={t('Punto de partida')}
              error={errors.startingPoint}
              onLayout={track('startingPoint')}>
              {STARTING_POINT_OPTIONS.map((option) => (
                <OptionCard
                  key={option.value}
                  option={option}
                  selected={draft.startingPoint === option.value}
                  onPress={() => update('startingPoint', option.value)}
                />
              ))}
            </Field>

            <Field
              label={t('Cuántas horas puedes dedicarle')}
              hint={t('Horas reales a la semana, no las que te gustaría tener.')}>
              <Stepper
                value={draft.hoursPerWeek}
                onChange={(value) => update('hoursPerWeek', value)}
                min={HOURS_MIN}
                max={HOURS_MAX}
                step={HOURS_STEP}
                formatValue={(value) => `${value} h/semana`}
              />
            </Field>

            <Field
              label={t('Cuándo sueles trabajar')}
              error={errors.bands}
              onLayout={track('bands')}>
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

            <Field label={t('Ambición')} error={errors.ambition} onLayout={track('ambition')}>
              {AMBITION_OPTIONS.map((option) => (
                <OptionCard
                  key={option.value}
                  option={option}
                  selected={draft.ambition === option.value}
                  onPress={() => update('ambition', option.value)}
                />
              ))}
            </Field>
          </>
        ) : null}

        {show('prompts') ? (
          <Field
            label={t('Tus respuestas (opcional)')}
            hint={t('Cortas: es lo que hace que un perfil se lea.')}
            error={errors.prompts}
            onLayout={track('prompts')}>
            {draft.prompts.map((prompt, index) => (
              <View key={index} style={styles.prompt}>
                <ChipRow>
                  {PROMPT_QUESTIONS.map((question) => (
                    <Chip
                      key={question}
                      label={t(question)}
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
                  placeholder={index === 0 ? t('Tu respuesta') : t('Opcional')}
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
        ) : null}

        {show('links') ? (
          <Field
            label={t('Enlaces y redes (opcional)')}
            hint={
              githubLocked
                ? t(
                    'Tu GitHub está verificado: lo lleva el sello, no este campo. Para cambiarlo, desvincúlalo desde tu perfil.'
                  )
                : t(
                    'Lo que enseñe qué has hecho y dónde estás: portfolio, LinkedIn, Instagram, TikTok.'
                  )
            }
            error={errors.github}
            onLayout={track('github')}>
            <TextField
              value={draft.github}
              onChangeText={(value) => update('github', value)}
              placeholder="https://github.com/tuusuario"
              autoCapitalize="none"
              autoCorrect={false}
              inputMode="url"
              accessibilityLabel="GitHub"
              // Con sello, el enlace lo deriva el servidor de la identidad. Dejarlo
              // editable devolvería el ataque que cierra la verificación entera:
              // verifico como `alice` y enseño el GitHub de otro.
              editable={!githubLocked}
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
        ) : null}

        {saveError ? (
          <ThemedText type="small" themeColor="danger">
            {saveError}
          </ThemedText>
        ) : null}

        <View style={styles.actions}>
          <PrimaryButton
            label={saving ? t('Guardando…') : submitLabel}
            disabled={saving}
            onPress={handleSubmit}
          />
          {onCancel ? <SecondaryButton label={cancelLabel} onPress={onCancel} /> : null}
        </View>
      </KeyboardAwareScrollView>
    </View>
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
