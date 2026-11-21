import { Icon } from '@/components/icon';
import { FormSheet } from '@/components/form-sheet';
import { requestClose } from '@/components/close-button';
import { Image } from 'expo-image';
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ProjectFieldEdgeAlpha, Radii, Spacing } from '@/constants/theme';
import {
  ProjectPhotoError,
  newProjectId,
  useRepositories,
  type Project,
  type ProjectInput,
  type ProjectPhoto,
} from '@/data';
import { ThemeOverride, useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { pickAvatarPhoto } from './avatar-photo';
import { ProjectCardCaption } from './project-card-caption';
import {
  Field,
  PrimaryButton,
  CompactSecondaryButton as SecondaryButton,
  TextField,
} from './controls';

function EditorField({ label, ...props }: ComponentProps<typeof TextField> & { label: string }) {
  const theme = useTheme();
  return (
    <Field label={label}>
      <ThemeOverride.Provider value={{ ...theme, border: theme.textMuted + ProjectFieldEdgeAlpha }}>
        <TextField {...props} accessibilityLabel={label} />
      </ThemeOverride.Provider>
    </Field>
  );
}

const empty: ProjectInput = {
  name: '',
  tagline: '',
  description: '',
  link: '',
  cover: null,
  photos: [],
};
export function ProjectEditor({
  project,
  canPromote,
  matchId,
  groupProject = false,
  createWithGroup,
  header,
  onClose,
  onSaved,
}: {
  project?: Project;
  canPromote: boolean;
  matchId?: string;
  groupProject?: boolean;
  /** El grupo y su proyecto se guardan juntos tras moderar todas las fotos. */
  createWithGroup?: (draft: ProjectInput) => Promise<void>;
  /** Controles propios de quien abre el editor, encima del formulario. */
  header?: ReactNode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { projects } = useRepositories();
  const isJoint = !!matchId || (project?.authors?.length ?? 0) > 1;
  const theme = useTheme();
  const [original] = useState<ProjectInput>(project ?? empty);
  const [draft, setDraft] = useState(original);
  const [details, setDetails] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [draftId] = useState(newProjectId);
  const [review, setReview] = useState(false);
  const [error, setError] = useState('');
  const [failedSlot, setFailedSlot] = useState<number | null>(null);
  // Despierta la función de moderación mientras se rellena el formulario: así el
  // primer guardado no paga el arranque en frío.
  useEffect(() => {
    void projects.warmUpModeration().catch(() => {});
  }, [projects]);
  const change =(patch: Partial<ProjectInput>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError('');
    setFailedSlot(null);
  };
  async function run(task: () => Promise<void>, close = false) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setFailedSlot(null);
    try {
      await task();
      if (close) onSaved();
    } catch (cause) {
      if (cause instanceof ProjectPhotoError) {
        setFailedSlot(cause.slot);
        if (cause.slot > 0) setDetails(true);
      }
      setError(cause instanceof Error ? cause.message : t('No se ha podido guardar.'));
    } finally {
      locked.current = false;
      setBusy(false);
      setReview(false);
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
  function photoItem(photo: ProjectPhoto, slot: number) {
    const label = t('Foto {n}', { n: slot });
    return (
      <View key={slot} style={styles.photoRow}>
        <Image
          cachePolicy={photo.headers ? 'none' : undefined}
          source={{ uri: photo.uri, headers: photo.headers }}
          style={styles.thumb}
          accessibilityLabel={label}
        />
        <View style={styles.photoActions}>
          <ThemedText type="smallBold">{label}</ThemedText>
          {review && !photo.path ? (
            <ThemedText accessibilityLiveRegion="polite">{t('En revisión…')}</ThemedText>
          ) : null}
          {failedSlot === slot ? <ThemedText themeColor="danger">{error}</ThemedText> : null}
          <SecondaryButton
            label={t('Quitar esta foto')}
            disabled={busy}
            onPress={() => change({ photos: draft.photos.filter((_, i) => i !== slot - 1) })}
          />
        </View>
      </View>
    );
  }
  return (
    <FormSheet
      disabled={busy}
      onClose={() => requestClose(JSON.stringify(draft) !== JSON.stringify(original), onClose)}
      header={
        <ThemedText type="title">
          {project
            ? t('Editar proyecto')
            : isJoint
              ? t('Crear proyecto juntos')
              : t('Crear proyecto')}
        </ThemedText>
      }
      footer={
        <PrimaryButton
          label={busy ? t('Guardando…') : t('Guardar proyecto')}
          disabled={busy || !draft.name.trim() || !draft.tagline.trim()}
          onPress={() =>
            void run(async () => {
              setReview(true);
              if (draft.photos.some((photo) => !photo.path)) setDetails(true);
              if (createWithGroup) await createWithGroup(draft);
              else if (!project && matchId) await projects.save(draft, undefined, draftId, matchId);
              else await projects.save(draft, project, project ? undefined : draftId);
            }, true)
          }
        />
      }>
      {header}
      <ThemedText type="label" themeColor="textSecondary">
        {t('Lo que se ve en la tarjeta')}
      </ThemedText>
      <EditorField
        label={t('Nombre del proyecto')}
        testID="project-name"
        editable={!busy}
        value={draft.name}
        maxLength={100}
        onChangeText={(name) => change({ name })}
      />
      <EditorField
        label={t('Frase corta')}
        testID="project-tagline"
        editable={!busy}
        value={draft.tagline}
        maxLength={100}
        showCount
        onChangeText={(tagline) => change({ tagline })}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={draft.cover ? t('Portada') : t('Añadir portada')}
        disabled={busy}
        onPress={() => pick(true)}
        style={[
          styles.cover,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.textMuted + ProjectFieldEdgeAlpha,
          },
        ]}>
        {draft.cover ? (
          <Image
            accessibilityLabel={t('Portada')}
            source={{ uri: draft.cover.uri, headers: draft.cover.headers }}
            cachePolicy={draft.cover.headers ? 'none' : undefined}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <>
            <Icon name="camera" size={26} color={theme.textSecondary} />
            <ThemedText type="smallBold">{t('Añadir portada')}</ThemedText>
          </>
        )}
        {!!draft.name.trim() && (
          <View pointerEvents="none" style={styles.coverCaption}>
            <ProjectCardCaption name={draft.name} project={project} />
          </View>
        )}
      </Pressable>
      {draft.cover && (
        <SecondaryButton
          label={t('Quitar esta foto')}
          disabled={busy}
          onPress={() => change({ cover: null })}
        />
      )}
      {review && draft.cover && !draft.cover.path && (
        <ThemedText accessibilityLiveRegion="polite">{t('En revisión…')}</ThemedText>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: details }}
        onPress={() => setDetails(!details)}
        style={styles.disclosure}>
        <ThemedText type="bodyStrong">{t('Más detalles')}</ThemedText>
        <View style={{ transform: [{ rotate: details ? '90deg' : '-90deg' }] }}>
          <Icon name="back" size={16} color={theme.textSecondary} />
        </View>
      </Pressable>
      {details ? (
        <>
          <EditorField
            label={t('Descripción')}
            multiline
            maxLength={5000}
            editable={!busy}
            value={draft.description}
            onChangeText={(description) => change({ description })}
          />
          {draft.photos.map((photo, i) => photoItem(photo, i + 1))}
          {draft.photos.length < 5 ? (
            <SecondaryButton
              label={t('Añadir foto ({n}/5)', { n: draft.photos.length })}
              disabled={busy}
              onPress={() => pick(false)}
            />
          ) : null}
          <EditorField
            label={t('Enlace del proyecto')}
            inputMode="url"
            autoCorrect={false}
            autoCapitalize="none"
            editable={!busy}
            value={draft.link}
            onChangeText={(link) => change({ link })}
          />
        </>
      ) : null}
      {error ? (
        <ThemedText accessibilityRole="alert" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
      {project && canPromote ? (
        <SecondaryButton
          label={t('Mover al principio')}
          disabled={busy}
          onPress={() => void run(() => projects.promote(project), true)}
        />
      ) : null}
      {project && !groupProject ? (
        confirm ? (
          <View style={styles.form}>
            <ThemedText>{t('¿Eliminar este proyecto?')}</ThemedText>
            {isJoint && (
              <ThemedText themeColor="textSecondary">
                {t(
                  'Avisaremos a la otra persona. Las tareas y las reuniones seguirán en el plan compartido.'
                )}
              </ThemedText>
            )}
            <SecondaryButton
              tone="danger"
              disabled={busy}
              label={t('Confirmar eliminación')}
              onPress={() => void run(() => projects.remove(project), true)}
            />
            <SecondaryButton
              label={t('Conservar proyecto')}
              disabled={busy}
              onPress={() => setConfirm(false)}
            />
          </View>
        ) : (
          <SecondaryButton
            label={t('Eliminar proyecto')}
            tone="danger"
            disabled={busy}
            onPress={() => setConfirm(true)}
          />
        )
      ) : null}
    </FormSheet>
  );
}
const styles = StyleSheet.create({
  coverCaption: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  cover: {
    width: '100%',
    maxWidth: 230,
    aspectRatio: 4 / 5,
    borderRadius: Radii.medium,
    borderWidth: 1,
    alignSelf: 'center',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  disclosure: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  form: { padding: Spacing.four, gap: Spacing.three },
  photoRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  photoActions: { flex: 1 },
  thumb: { width: 80, height: 96, borderRadius: Radii.small },
});
