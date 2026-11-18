import { Image } from 'expo-image';
import { useContext, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { DetailsChevron } from '@/components/animations/ProfileMotion';
import { useProjectSheet } from '@/components/animations/ShrinkToSlot';
import { BottomSheet, BottomSheetFrame } from '@/components/BottomSheet';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Control, Duration, Opacity, Radii, Spacing, Stroke } from '@/constants/theme';
import {
  newProjectId,
  ProjectPhotoError,
  useRepositories,
  validateProject,
  type Project,
  type ProjectInput,
} from '@/data';
import { ThemeOverride, useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { pickAvatarPhoto } from './avatar-photo';
import { Field, TextField } from './controls';
import { ProjectCover, ProjectPrimaryButton } from './project-card';

const empty: ProjectInput = {
  name: '',
  tagline: '',
  description: '',
  link: '',
  cover: null,
  photos: [],
};
const compact = [0.68];
const expanded = [0.94];
const detailsFade = FadeIn.duration(Duration.fast).reduceMotion(ReduceMotion.Never);

function EditorField({ label, ...props }: ComponentProps<typeof TextField> & { label: string }) {
  const theme = useTheme();
  // A neutral edge remains visible against both the graphite sheet and its lighter input fill.
  return (
    <Field label={label}>
      <ThemeOverride.Provider value={{ ...theme, border: theme.textMuted + 'B3' }}>
        <TextField {...props} accessibilityLabel={label} />
      </ThemeOverride.Provider>
    </Field>
  );
}

function EditorAction({
  label,
  onPress,
  disabled = false,
  danger = false,
  expanded,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  expanded?: boolean;
  children?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, expanded }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.action, { opacity: pressed ? Opacity.pressed : 1 }]}>
      <ThemedText
        type="smallBold"
        themeColor={danger ? 'danger' : 'textSecondary'}
        style={styles.flex}>
        {label}
      </ThemedText>
      {children}
    </Pressable>
  );
}

function SaveFooter({
  busy,
  valid,
  saving,
  error,
  onSave,
}: {
  busy: boolean;
  valid: boolean;
  saving: boolean;
  error: string;
  onSave: () => void;
}) {
  const frame = useContext(BottomSheetFrame);
  useProjectSheet(frame);
  return (
    <View style={styles.footer}>
      {error ? (
        <ThemedText accessibilityRole="alert" type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
      <ProjectPrimaryButton
        label={saving ? t('Guardando…') : t('Guardar proyecto')}
        disabled={busy || !valid}
        onPress={onSave}
      />
    </View>
  );
}

export function ProjectEditor({
  project,
  canPromote,
  onClose,
  onSaved,
}: {
  project?: Project;
  canPromote: boolean;
  onClose: () => void;
  /** Puede esperar: la hoja sigue bloqueada mientras vuela hasta su tarjeta. */
  onSaved: (id: string, draft: ProjectInput) => void | Promise<void>;
}) {
  const { projects } = useRepositories();
  const theme = useTheme();
  const original = project ?? empty;
  const [draft, setDraft] = useState<ProjectInput>(original);
  const [details, setDetails] = useState(false);
  const [confirmation, setConfirmation] = useState<'discard' | 'remove' | 'promote' | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [draftId] = useState(newProjectId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [failedSlot, setFailedSlot] = useState<number | null>(null);

  const dirty = draft !== original && JSON.stringify(draft) !== JSON.stringify(original);
  const hasRequiredFields = !!(draft.name.trim() && draft.tagline.trim());
  let validationError = '';
  if (hasRequiredFields) {
    try {
      validateProject(draft);
    } catch (cause) {
      if (cause instanceof Error) validationError = cause.message;
    }
  }

  function change(patch: Partial<ProjectInput>) {
    setDraft((current) => ({ ...current, ...patch }));
    setError('');
    setFailedSlot(null);
  }
  async function run(task: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setFailedSlot(null);
    try {
      await task();
    } catch (cause) {
      if (cause instanceof ProjectPhotoError) {
        setFailedSlot(cause.slot);
        if (cause.slot > 0) setDetails(true);
      }
      setError(cause instanceof Error ? cause.message : t('No se ha podido guardar.'));
    } finally {
      locked.current = false;
      setBusy(false);
      setSaving(false);
    }
  }
  function pick(cover: boolean) {
    void run(async () => {
      const result = await pickAvatarPhoto('library', cover ? [4, 5] : [1, 1]);
      if (result.status === 'denied')
        throw new Error(t('Sin permiso para tus fotos no podemos subir ninguna.'));
      if (result.status === 'picked') {
        const photo = { uri: result.uri };
        change(cover ? { cover: photo } : { photos: [...draft.photos, photo] });
      }
    });
  }
  function save() {
    void run(async () => {
      setSaving(true);
      if (draft.photos.some((photo) => !photo.path)) setDetails(true);
      await projects.save(draft, project, project ? undefined : draftId);
      await onSaved(project?.id ?? draftId, draft);
    });
  }
  function promote() {
    if (!project) return;
    void run(async () => {
      await projects.promote(project);
      onClose();
    });
  }
  function requestExit(action: 'discard' | 'promote') {
    if (locked.current) return;
    if (confirmation) {
      setConfirmation(null);
    } else if (dirty) {
      Keyboard.dismiss();
      setConfirmation(action);
    } else if (action === 'promote') {
      promote();
    } else {
      onClose();
    }
  }
  function confirmExit() {
    if (confirmation === 'remove' && project) {
      void run(async () => {
        await projects.remove(project);
        onClose();
      });
    } else if (confirmation === 'promote') {
      promote();
    } else {
      onClose();
    }
  }

  const coverAction = draft.cover ? t('Cambiar portada') : t('Añadir portada');
  return (
    <BottomSheet
      visible
      title={project ? t('Editar proyecto') : t('Crear proyecto')}
      onClose={() => requestExit('discard')}
      snapPoints={details && !confirmation ? expanded : compact}
      footer={
        confirmation ? undefined : (
          <SaveFooter
            busy={busy}
            saving={saving}
            valid={dirty && hasRequiredFields && !validationError}
            error={error || validationError}
            onSave={save}
          />
        )
      }>
      {confirmation ? (
        <View style={styles.confirm}>
          <ThemedText type="heading" accessibilityRole="header">
            {confirmation === 'remove'
              ? t('¿Eliminar este proyecto?')
              : t('¿Descartar los cambios de este proyecto?')}
          </ThemedText>
          <EditorAction
            label={confirmation === 'remove' ? t('Conservar proyecto') : t('Seguir editando')}
            disabled={busy}
            onPress={() => setConfirmation(null)}
          />
          <EditorAction
            danger
            label={confirmation === 'remove' ? t('Confirmar eliminación') : t('Descartar cambios')}
            disabled={busy}
            onPress={confirmExit}
          />
          {error ? (
            <ThemedText type="small" accessibilityRole="alert" themeColor="danger">
              {error}
            </ThemedText>
          ) : null}
        </View>
      ) : (
        <View style={styles.form}>
          <View style={styles.preview}>
            <ThemedText type="label" themeColor="textSecondary">
              {t('Lo que se ve en la tarjeta')}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={coverAction}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => pick(true)}
              style={({ pressed }) => ({ opacity: pressed ? Opacity.pressed : 1 })}>
              <ProjectCover
                cover={draft.cover}
                name={draft.name}
                placeholder={t('Nombre del proyecto')}
                tagline={draft.tagline || t('Frase corta')}
              />
              <View
                style={[
                  styles.coverAction,
                  { backgroundColor: theme.surfaceOpaque, borderColor: theme.border },
                ]}>
                <Icon name="camera" size={16} color={theme.text} />
                <ThemedText type="smallBold">{coverAction}</ThemedText>
              </View>
            </Pressable>
            {draft.cover ? (
              <View>
                {saving && !draft.cover.path ? (
                  <ThemedText type="small" accessibilityLiveRegion="polite">
                    {t('En revisión…')}
                  </ThemedText>
                ) : null}
                {failedSlot === 0 ? (
                  <ThemedText type="small" themeColor="danger">
                    {error}
                  </ThemedText>
                ) : null}
                <EditorAction
                  label={t('Quitar esta foto')}
                  disabled={busy}
                  onPress={() => change({ cover: null })}
                />
              </View>
            ) : null}
          </View>
          <EditorField
            testID="project-name"
            label={t('Nombre del proyecto')}
            editable={!busy}
            value={draft.name}
            maxLength={100}
            onChangeText={(name) => change({ name })}
          />
          <EditorField
            testID="project-tagline"
            label={t('Frase corta')}
            editable={!busy}
            value={draft.tagline}
            maxLength={100}
            showCount
            onChangeText={(tagline) => change({ tagline })}
          />
          <View style={[styles.detailHeader, { borderColor: theme.border }]}>
            <EditorAction
              label={details ? t('Ocultar detalles') : t('Más detalles')}
              disabled={busy}
              expanded={details}
              onPress={() => setDetails(!details)}>
              <DetailsChevron expanded={details}>
                <Icon name="back" color={theme.textSecondary} size={18} />
              </DetailsChevron>
            </EditorAction>
          </View>
          {details ? (
            <Animated.View entering={detailsFade} style={styles.details}>
              <EditorField
                label={t('Descripción')}
                multiline
                maxLength={5000}
                editable={!busy}
                value={draft.description}
                onChangeText={(description) => change({ description })}
              />
              <EditorField
                label={t('Enlace del proyecto')}
                inputMode="url"
                autoCorrect={false}
                autoCapitalize="none"
                editable={!busy}
                value={draft.link}
                onChangeText={(link) => change({ link })}
              />
              <View style={styles.gallery}>
                {draft.photos.map((photo, i) => (
                  <View key={i} style={styles.photoRow}>
                    <Image source={{ uri: photo.uri }} style={styles.thumb} />
                    <View style={styles.flex}>
                      <ThemedText type="smallBold">{t('Foto {n}', { n: i + 1 })}</ThemedText>
                      {saving && !photo.path ? (
                        <ThemedText type="small" accessibilityLiveRegion="polite">
                          {t('En revisión…')}
                        </ThemedText>
                      ) : null}
                      {failedSlot === i + 1 ? (
                        <ThemedText type="small" themeColor="danger">
                          {error}
                        </ThemedText>
                      ) : null}
                      <EditorAction
                        label={t('Quitar esta foto')}
                        disabled={busy}
                        onPress={() =>
                          change({ photos: draft.photos.filter((_, index) => index !== i) })
                        }
                      />
                    </View>
                  </View>
                ))}
                {draft.photos.length < 5 ? (
                  <EditorAction
                    label={t('Añadir foto ({n}/5)', { n: draft.photos.length })}
                    disabled={busy}
                    onPress={() => pick(false)}
                  />
                ) : null}
              </View>
            </Animated.View>
          ) : null}
          {project ? (
            <View style={[styles.detailHeader, { borderColor: theme.border }]}>
              {canPromote ? (
                <EditorAction
                  label={t('Mover al principio')}
                  disabled={busy}
                  onPress={() => requestExit('promote')}
                />
              ) : null}
              <EditorAction
                label={t('Eliminar proyecto')}
                danger
                disabled={busy}
                onPress={() => {
                  Keyboard.dismiss();
                  setConfirmation('remove');
                }}
              />
            </View>
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { paddingTop: Spacing.two, gap: Spacing.four },
  details: { gap: Spacing.four },
  confirm: { paddingVertical: Spacing.four, gap: Spacing.two },
  preview: { gap: Spacing.two },
  coverAction: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: Stroke.hairline,
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radii.pill,
  },
  detailHeader: { borderTopWidth: Stroke.hairline, paddingTop: Spacing.two },
  action: {
    minHeight: Control.minTouch,
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  flex: { flex: 1 },
  gallery: { gap: Spacing.three },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  thumb: { width: 64, height: 64, borderRadius: Radii.small },
  footer: { gap: Spacing.two },
});
