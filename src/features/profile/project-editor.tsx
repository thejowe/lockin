import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import {
  ProjectPhotoError,
  useRepositories,
  type Project,
  type ProjectInput,
  type ProjectPhoto,
} from '@/data';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { pickAvatarPhoto } from './avatar-photo';
import { Field, PrimaryButton, SecondaryButton, TextField } from './controls';

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
  onClose,
  onSaved,
}: {
  project?: Project;
  canPromote: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { projects } = useRepositories();
  const theme = useTheme();
  const reduced = useReduceMotion();
  const [draft, setDraft] = useState<ProjectInput>(project ?? empty);
  const [details, setDetails] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [review, setReview] = useState(false);
  const [error, setError] = useState('');
  const [failedSlot, setFailedSlot] = useState<number | null>(null);
  const change = (patch: Partial<ProjectInput>) => {
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
    const label = slot === 0 ? t('Portada') : t('Foto {n}', { n: slot });
    return (
      <View key={slot} style={styles.photoRow}>
        <Image source={{ uri: photo.uri }} style={styles.thumb} accessibilityLabel={label} />
        <View style={styles.photoActions}>
          <ThemedText type="smallBold">{label}</ThemedText>
          {review && !photo.path ? (
            <ThemedText accessibilityLiveRegion="polite">{t('En revisión…')}</ThemedText>
          ) : null}
          {failedSlot === slot ? <ThemedText themeColor="danger">{error}</ThemedText> : null}
          <SecondaryButton
            label={t('Quitar esta foto')}
            disabled={busy}
            onPress={() =>
              change(
                slot === 0
                  ? { cover: null }
                  : { photos: draft.photos.filter((_, i) => i !== slot - 1) }
              )
            }
          />
        </View>
      </View>
    );
  }
  return (
    <Modal
      visible
      animationType={reduced ? 'none' : 'slide'}
      onRequestClose={() => {
        if (!busy) onClose();
      }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
          <ThemedText type="title">
            {project ? t('Editar proyecto') : t('Crear proyecto')}
          </ThemedText>
          <ThemedText type="subtitle">{t('Lo que se ve en la tarjeta')}</ThemedText>
          <Field label={t('Nombre del proyecto')}>
            <TextField
              accessibilityLabel={t('Nombre del proyecto')}
              editable={!busy}
              value={draft.name}
              maxLength={100}
              onChangeText={(name) => change({ name })}
            />
          </Field>
          <Field label={t('Frase corta')}>
            <TextField
              accessibilityLabel={t('Frase corta')}
              editable={!busy}
              value={draft.tagline}
              maxLength={100}
              showCount
              onChangeText={(tagline) => change({ tagline })}
            />
          </Field>
          {draft.cover ? (
            photoItem(draft.cover, 0)
          ) : (
            <SecondaryButton
              label={t('Añadir portada')}
              disabled={busy}
              onPress={() => pick(true)}
            />
          )}
          <SecondaryButton
            label={details ? t('Ocultar detalles') : t('Más detalles')}
            disabled={busy}
            onPress={() => setDetails(!details)}
          />
          {details ? (
            <>
              <Field label={t('Descripción')}>
                <TextField
                  accessibilityLabel={t('Descripción')}
                  multiline
                  maxLength={5000}
                  editable={!busy}
                  value={draft.description}
                  onChangeText={(description) => change({ description })}
                />
              </Field>
              {draft.photos.map((photo, i) => photoItem(photo, i + 1))}
              {draft.photos.length < 5 ? (
                <SecondaryButton
                  label={t('Añadir foto ({n}/5)', { n: draft.photos.length })}
                  disabled={busy}
                  onPress={() => pick(false)}
                />
              ) : null}
              <Field label={t('Enlace del proyecto')}>
                <TextField
                  accessibilityLabel={t('Enlace del proyecto')}
                  inputMode="url"
                  autoCorrect={false}
                  autoCapitalize="none"
                  editable={!busy}
                  value={draft.link}
                  onChangeText={(link) => change({ link })}
                />
              </Field>
            </>
          ) : null}
          {error ? (
            <ThemedText accessibilityRole="alert" themeColor="danger">
              {error}
            </ThemedText>
          ) : null}
          <PrimaryButton
            label={busy ? t('Guardando…') : t('Guardar proyecto')}
            disabled={busy || !draft.name.trim() || !draft.tagline.trim()}
            onPress={() =>
              void run(async () => {
                setReview(true);
                if (draft.photos.some((photo) => !photo.path)) setDetails(true);
                await projects.save(draft, project);
              }, true)
            }
          />
          {project && canPromote ? (
            <SecondaryButton
              label={t('Mover al principio')}
              disabled={busy}
              onPress={() => void run(() => projects.promote(project), true)}
            />
          ) : null}
          {project ? (
            confirm ? (
              <View style={styles.form}>
                <ThemedText>{t('¿Eliminar este proyecto?')}</ThemedText>
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
          <SecondaryButton label={t('Cancelar')} disabled={busy} onPress={onClose} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  form: { padding: Spacing.four, gap: Spacing.three },
  photoRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  photoActions: { flex: 1 },
  thumb: { width: 80, height: 96, borderRadius: Radii.small },
});
