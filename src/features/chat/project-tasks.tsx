import { FormSheet } from '@/components/form-sheet';
import { requestClose } from '@/components/close-button';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { uuid } from 'expo';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Control, Opacity, Spacing, Stroke } from '@/constants/theme';
import {
  PlanConflictError,
  type PlanDraft,
  type PlanItem,
  type TaskDetails,
} from '@/data/chat-plan';
import { Chip, ChipRow, Field, TextField } from '@/features/profile/controls';
import { useTheme } from '@/hooks/use-theme';
import { getIntlLocale, t } from '@/i18n';

export type TaskMembers = { id: string | null; label: string }[];

function statuses() {
  return { pending: t('Pendiente'), in_progress: t('En curso'), done: t('Hecha') };
}

function formatDate(value: Date) {
  return [value.getDate(), value.getMonth() + 1, value.getFullYear()]
    .map((n) => String(n).padStart(2, '0'))
    .join('/');
}

// La tarea vence al final del día local que selecciona quien la programa.
function deadline(text: string): string | null {
  const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!parts) return null;
  const [, day, month, year] = parts.map(Number);
  const date = new Date(year, month - 1, day, 23, 59);
  return formatDate(date) === text ? date.toISOString() : null;
}

function TaskEditor({
  item,
  members,
  save,
  onClose,
  onConflict,
}: {
  item: PlanItem | null;
  members: TaskMembers;
  save: (draft: PlanDraft & TaskDetails) => Promise<void>;
  onClose: () => void;
  /** La otra persona la cambió mientras tanto: se cierra y se recarga en vez de pisarla. */
  onConflict: () => void;
}) {
  const [id] = useState(() => item?.id ?? uuid.v4());
  const [title, setTitle] = useState(item?.title ?? '');
  const [assignee, setAssignee] = useState<string | null>(item?.assigneeId ?? null);
  const [status, setStatus] = useState<TaskDetails['status']>(
    item?.status ?? (item?.closed ? 'done' : 'pending')
  );
  const originalDate = item?.dueAt ? formatDate(new Date(item.dueAt)) : '';
  const [date, setDate] = useState(originalDate);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function submit() {
    if (lock.current) return;
    const dueAt = date === originalDate ? (item?.dueAt ?? null) : deadline(date);
    if (date && !dueAt) {
      setError(t('Introduce una fecha válida (DD/MM/AAAA).'));
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await save({
        id,
        title: title.trim(),
        assigneeId: assignee,
        status,
        dueAt,
        startsAt: null,
        place: null,
      });
      onClose();
    } catch (cause) {
      if (cause instanceof PlanConflictError) {
        onConflict();
        return;
      }
      setError(t('No se ha podido guardar. Vuelve a intentarlo.'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <FormSheet
      header={<ThemedText type="subtitle">{item ? title : t('Añadir tarea')}</ThemedText>}
      disabled={busy}
      onClose={() =>
        requestClose(
          title !== (item?.title ?? '') ||
            assignee !== (item?.assigneeId ?? null) ||
            date !== originalDate ||
            status !== (item?.status ?? (item?.closed ? 'done' : 'pending')),
          onClose
        )
      }
      footer={<Button label={t('Guardar')} onPress={submit} disabled={!title.trim() || busy} />}>
      {!item && (
        <Field label={t('Nombre de la tarea')}>
          <TextField
            accessibilityLabel={t('Nombre de la tarea')}
            value={title}
            onChangeText={setTitle}
            maxLength={160}
            editable={!busy}
          />
        </Field>
      )}
      <Field label={t('Responsable')}>
        <ChipRow>
          {members.map(({ id: target, label }) => (
            <Chip
              key={target ?? 'both'}
              label={label}
              selected={assignee === target}
              onPress={() => setAssignee(target)}
            />
          ))}
        </ChipRow>
      </Field>
      <Field label={t('Fecha límite (opcional)')}>
        <TextField
          accessibilityLabel={t('Fecha límite (opcional)')}
          placeholder={t('DD/MM/AAAA')}
          value={date}
          onChangeText={(value) =>
            setDate(
              value
                .replace(/\D/g, '')
                .slice(0, 8)
                .replace(/^(\d{2})(\d)/, '$1/$2')
                .replace(/^(\d{2}\/\d{2})(\d)/, '$1/$2')
            )
          }
          editable={!busy}
          keyboardType="number-pad"
          maxLength={10}
        />
      </Field>
      <Field label={t('Estado')}>
        <ChipRow>
          {(Object.entries(statuses()) as [TaskDetails['status'], string][]).map(
            ([value, label]) => (
              <Chip
                key={value}
                label={label}
                selected={value === status}
                onPress={() => setStatus(value)}
              />
            )
          )}
        </ChipRow>
      </Field>
      {error ? (
        <ThemedText accessibilityRole="alert" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
    </FormSheet>
  );
}

export function ProjectTasks({
  tasks,
  members,
  add,
  update,
  reload,
}: {
  tasks: PlanItem[];
  members: TaskMembers;
  add: (draft: PlanDraft & TaskDetails) => Promise<void>;
  update: (id: string, details: TaskDetails, revision?: string) => Promise<void>;
  reload: () => void;
}) {
  const [editing, setEditing] = useState<PlanItem | 'new' | null>(null);
  const [conflict, setConflict] = useState(false);
  const [filter, setFilter] = useState<string | null | 'all'>('all');
  const theme = useTheme();
  const visible = tasks.filter((item) => filter === 'all' || (item.assigneeId ?? null) === filter);
  return (
    <View style={styles.section}>
      <ThemedText type="subtitle">{t('Tareas')}</ThemedText>
      {editing ? (
        <TaskEditor
          members={members}
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onConflict={() => {
            setEditing(null);
            setConflict(true);
            reload();
          }}
          save={async (draft) => {
            setConflict(false);
            if (editing === 'new') await add(draft);
            else
              await update(
                draft.id,
                { assigneeId: draft.assigneeId, dueAt: draft.dueAt, status: draft.status },
                editing.revision
              );
          }}
        />
      ) : (
        <>
          {conflict ? (
            <ThemedText accessibilityRole="alert" themeColor="danger">
              {t(
                'La otra persona ha cambiado esta tarea. Te mostramos su versión: revísala y vuelve a editarla.'
              )}
            </ThemedText>
          ) : null}
          {tasks.length > 0 && (
            <Field label={t('Filtrar por responsable')}>
              <ChipRow>
                {[{ id: 'all', label: t('Todas') }, ...members].map(({ id, label }) => (
                  <Chip
                    key={id ?? 'both'}
                    label={label}
                    selected={id === filter}
                    onPress={() => setFilter(id)}
                  />
                ))}
              </ChipRow>
            </Field>
          )}
          {visible.map((item) => {
            const status = item.status ?? (item.closed ? 'done' : 'pending');
            const person = members.find((person) => person.id === (item.assigneeId ?? null))?.label;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityHint={t('Editar tarea')}
                onPress={() => setEditing(item)}
                style={({ pressed }) => [
                  styles.task,
                  { borderColor: theme.border, opacity: pressed ? Opacity.pressed : 1 },
                ]}>
                <ThemedText
                  type="bodyStrong"
                  style={{ textDecorationLine: item.closed ? 'line-through' : 'none' }}>
                  {item.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {[
                    statuses()[status],
                    person,
                    item.dueAt && new Date(item.dueAt).toLocaleDateString(getIntlLocale()),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
              </Pressable>
            );
          })}
          {!visible.length && (
            <ThemedText themeColor="textSecondary">
              {tasks.length
                ? t('No hay tareas con este responsable.')
                : t('¿Cuál es vuestro siguiente paso?')}
            </ThemedText>
          )}
          <Button
            compact
            variant="secondary"
            label={t('Añadir tarea')}
            onPress={() => setEditing('new')}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  task: {
    minHeight: Control.minTouch,
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderBottomWidth: Stroke.hairline,
  },
});
