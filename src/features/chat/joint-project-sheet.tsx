import { Image } from 'expo-image';
import { useRef, useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { FormSheet } from '@/components/form-sheet';

import { Button } from '@/components/button';
import { glassStyle } from '@/components/glass';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Control, Opacity, Radii, Spacing } from '@/constants/theme';
import {
  useRepositories,
  type JointWorkspace,
  type Project,
  type ProjectPhoto,
  type PublicationAction,
} from '@/data';
import { ProjectAuthorFaces } from '@/features/profile/project-author-faces';
import { TextField } from '@/features/profile/controls';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

function Photo({
  photo,
  size,
  label,
}: {
  photo: ProjectPhoto;
  size: 'thumb' | 'cover' | 'extra';
  label: string;
}) {
  return (
    <Image
      source={{ uri: photo.uri, headers: photo.headers }}
      cachePolicy={photo.headers ? 'none' : undefined}
      accessibilityLabel={label}
      contentFit="cover"
      style={styles[size]}
    />
  );
}

export function ProjectCard({
  project,
  onPress,
  readOnly = false,
}: {
  project?: Project;
  onPress: () => void;
  readOnly?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        project ? t('Ver ficha de {name}', { name: project.name }) : t('Crear proyecto juntos')
      }
      onPress={onPress}
      style={({ pressed }) => [
        glassStyle(theme, { radius: Radii.medium }),
        styles.card,
        { opacity: pressed ? Opacity.pressed : 1 },
      ]}>
      {project?.cover ? (
        <Photo photo={project.cover} size="thumb" label={t('Portada')} />
      ) : (
        <View
          style={[styles.thumb, styles.placeholder, { backgroundColor: theme.backgroundSelected }]}>
          <Icon name={project ? 'document' : 'pair'} color={theme.textSecondary} />
        </View>
      )}
      <View style={styles.cardTitle}>
        <ThemedText type="heading" numberOfLines={2}>
          {project?.name ?? t('Crear proyecto juntos')}
        </ThemedText>
        {!project && (
          <ThemedText type="small" themeColor="textSecondary">
            {t('Un espacio privado para lo que construyáis juntos.')}
          </ThemedText>
        )}
      </View>
      <Icon
        name={project && !readOnly ? 'pencil' : 'chevrons'}
        size={18}
        color={theme.textSecondary}
      />
    </Pressable>
  );
}

type VisibilityProps = { workspace: JointWorkspace; me: string; onChange: () => void };

export function PublicationControls({
  workspace,
  me,
  onChange,
  inSheet = false,
}: VisibilityProps & { inSheet?: boolean }) {
  const { projects } = useRepositories();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const theme = useTheme();
  const { proposedBy, published, hasCapacity } = workspace;
  const incoming = !!proposedBy && proposedBy !== me;
  const switchDisabled = busy || !!proposedBy || (!published && !hasCapacity);
  async function change(action: PublicationAction) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await projects.publication(workspace.project, action);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t('No se ha podido guardar. Vuelve a intentarlo.')
      );
    } finally {
      lock.current = false;
      setBusy(false);
      onChange();
    }
  }
  if (!inSheet && !incoming) return null;
  return (
    <View
      style={[
        !inSheet && glassStyle(theme, { radius: Radii.medium }),
        !inSheet && styles.inset,
        styles.section,
      ]}>
      {inSheet && (
        <View style={styles.switchRow}>
          <ThemedText type="bodyStrong" style={styles.cardTitle}>
            {t('Publicar en los perfiles')}
          </ThemedText>
          <Switch
            testID="project-publish-switch"
            accessibilityLabel={t('Publicar en los perfiles')}
            value={published}
            accessibilityState={{ disabled: switchDisabled, checked: published }}
            disabled={switchDisabled}
            onValueChange={(show) => void change(show ? 'propose' : 'private')}
          />
        </View>
      )}
      {incoming ? (
        <>
          <ThemedText type="heading">{t('¿Publicar en vuestros perfiles?')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t(
              'Se mostrará la ficha en ambos perfiles. El plan y las notas seguirán siendo privados.'
            )}
          </ThemedText>
          <View style={styles.actions}>
            <Button
              compact
              label={t('Aceptar publicación')}
              disabled={busy || !hasCapacity}
              onPress={() => void change('accept')}
            />
            <Button
              compact
              variant="secondary"
              label={t('Rechazar')}
              disabled={busy}
              onPress={() => void change('reject')}
            />
          </View>
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {published
            ? t('La ficha aparece en ambos perfiles.')
            : proposedBy
              ? t('Pendiente de la otra persona.')
              : t('Solo vosotros podéis ver esta ficha.')}
        </ThemedText>
      )}
      {inSheet && proposedBy === me && (
        <Button
          compact
          variant="secondary"
          label={t('Retirar propuesta')}
          disabled={busy}
          onPress={() => void change('private')}
        />
      )}
      {!published && !hasCapacity && (
        <ThemedText accessibilityRole="alert" themeColor="danger">
          {t('Hace falta un espacio libre en cada perfil. El máximo es de tres proyectos.')}
        </ThemedText>
      )}
      {!!error && (
        <ThemedText accessibilityRole="alert" themeColor="danger">
          {error}
        </ThemedText>
      )}
    </View>
  );
}

export function ProjectSheet({
  workspace,
  me,
  onChange,
  onClose,
  onEdit,
}: VisibilityProps & {
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <ProjectDetailsSheet project={workspace.project} onClose={onClose} onEdit={onEdit}>
      <PublicationControls workspace={workspace} me={me} onChange={onChange} inSheet />
    </ProjectDetailsSheet>
  );
}

export function ProjectDetailsSheet({
  project,
  children,
  onClose,
  onEdit,
}: {
  project: Project;
  children?: ReactNode;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const [linkError, setLinkError] = useState(false);
  return (
    <FormSheet
      onClose={onClose}
      header={<ThemedText type="subtitle">{t('Ficha del proyecto')}</ThemedText>}
      footer={onEdit && <Button label={t('Editar proyecto')} onPress={onEdit} />}>
      {project.cover && <Photo photo={project.cover} size="cover" label={t('Portada')} />}
      <View style={styles.section}>
        <ThemedText type="title">{project.name}</ThemedText>
        <ThemedText type="bodyStrong">{project.tagline}</ThemedText>
        <ProjectAuthorFaces project={project} />
      </View>
      {!!project.description && <ThemedText selectable>{project.description}</ThemedText>}
      {project.photos.length > 0 && (
        <ScrollView horizontal contentContainerStyle={styles.actions}>
          {project.photos.map((photo, i) => (
            <Photo key={i} photo={photo} size="extra" label={t('Foto {n}', { n: i + 1 })} />
          ))}
        </ScrollView>
      )}
      {!!project.link && (
        <ThemedText
          type="link"
          accessibilityRole="link"
          onPress={() => void Linking.openURL(project.link).catch(() => setLinkError(true))}>
          {project.link}
        </ThemedText>
      )}
      {linkError && (
        <ThemedText accessibilityRole="alert">{t('No se ha podido abrir el enlace.')}</ThemedText>
      )}
      {children}
    </FormSheet>
  );
}

export function ProjectNotes({
  workspace,
  me,
  peerName,
  onChange,
}: VisibilityProps & { peerName: string }) {
  const { projects } = useRepositories();
  const [draft, setDraft] = useState<{ text: string; revision: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const conflict = !!draft && draft.revision !== workspace.notesRevision;
  async function save() {
    if (!draft || lock.current || conflict) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await projects.saveNotes(workspace.project.id, draft.text, draft.revision);
      setDraft(null);
    } catch {
      setError(t('No se ha podido guardar. Vuelve a intentarlo.'));
    } finally {
      lock.current = false;
      setBusy(false);
      onChange();
    }
  }
  return (
    <View style={styles.section}>
      <ThemedText type="subtitle">{t('Notas compartidas')}</ThemedText>
      {!!workspace.notesBy && (
        <ThemedText type="small" themeColor="textSecondary">
          {workspace.notesBy === me
            ? t('Has editado estas notas.')
            : t('Última edición de {name}', { name: peerName })}
        </ThemedText>
      )}
      <TextField
        accessibilityLabel={t('Notas compartidas')}
        placeholder={t('Ideas y decisiones del proyecto')}
        multiline
        maxLength={10000}
        editable={!busy}
        value={draft?.text ?? workspace.notes}
        onChangeText={(text) =>
          setDraft({ text, revision: draft?.revision ?? workspace.notesRevision })
        }
      />
      {conflict && (
        <>
          <ThemedText accessibilityRole="alert">
            {t('La otra persona ha guardado cambios. Revisa su versión antes de guardar la tuya.')}
          </ThemedText>
          <ThemedText selectable>{workspace.notes}</ThemedText>
          <Button
            compact
            variant="secondary"
            label={t('Usar su versión')}
            onPress={() => {
              setDraft(null);
              setError('');
            }}
          />
          <Button
            compact
            variant="secondary"
            label={t('Conservar mi borrador')}
            onPress={() => {
              setDraft({ ...draft, revision: workspace.notesRevision });
              setError('');
            }}
          />
        </>
      )}
      {!!error && (
        <ThemedText accessibilityRole="alert" themeColor="danger">
          {error}
        </ThemedText>
      )}
      {draft && !conflict && (
        <Button compact label={t('Guardar notas')} disabled={busy} onPress={save} />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  card: {
    minHeight: Control.button,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  cardTitle: { flex: 1 },
  inset: { padding: Spacing.three },
  thumb: { height: Control.field, width: Control.field, borderRadius: Radii.small },
  placeholder: { justifyContent: 'center', alignItems: 'center' },
  section: { gap: Spacing.two },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  cover: { width: '100%', aspectRatio: 1.6, borderRadius: Radii.medium },
  extra: { width: 110, height: 110, borderRadius: Radii.small },
  content: { padding: Spacing.four, gap: Spacing.four },
});
