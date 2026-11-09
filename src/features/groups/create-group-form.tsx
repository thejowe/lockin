/**
 * Formulario de un grupo: nombre, proyecto y los perfiles que se buscan, cada
 * uno con cuántas personas. Sirve para crearlo (`CreateGroupForm`) y para
 * editarlo después (`EditGroupForm`), que es lo que evita que un grupo se quede
 * atascado cuando lo que buscaba se llena o deja de tener sentido.
 *
 * Quien lo crea pasa a administrarlo y es su primer miembro, así que entre
 * todos los perfiles caben como mucho 5 personas. Al editar, además, un perfil
 * con alguien dentro no se puede quitar ni bajar de las personas que ya tiene:
 * para eso está expulsar.
 *
 * Las reglas son las de `validateGroupInput` / `validateGroupUpdate` (las
 * mismas que aplica el servidor); aquí solo se traducen a mensajes.
 */

import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  GROUP_DESCRIPTION_MAX,
  GROUP_DESCRIPTION_MIN,
  GROUP_NAME_MAX,
  GROUP_NAME_MIN,
  GROUP_MAX_MEMBERS,
  useRefreshQuery,
  useRepositories,
  validateGroupInput,
  validateGroupUpdate,
  type GroupRoleInput,
  type GroupView,
  type Specialty,
} from '@/data';
import { SPECIALTY_OPTIONS, specialtyLabel } from '@/features/profile';
import { Chip, ChipRow, Field, Stepper, TextField } from '@/features/profile/controls';
import { t } from '@/i18n';

import { groupErrorMessage } from './labels';
import { MY_GROUP_QUERY } from './use-my-group';

export function CreateGroupForm({ onCreated }: { onCreated: (view: GroupView) => void }) {
  return <GroupForm onSaved={onCreated} />;
}

export function EditGroupForm({
  view,
  onSaved,
}: {
  view: GroupView;
  onSaved: (view: GroupView) => void;
}) {
  return <GroupForm initial={view} onSaved={onSaved} />;
}

function GroupForm({
  initial,
  onSaved,
}: {
  /** El grupo que se edita; sin él, se crea uno nuevo. */
  initial?: GroupView;
  onSaved: (view: GroupView) => void;
}) {
  const repositories = useRepositories();
  const refreshMine = useRefreshQuery(MY_GROUP_QUERY);
  const editing = !!initial;
  const [name, setName] = useState(initial?.group.name ?? '');
  const [description, setDescription] = useState(initial?.group.description ?? '');
  const [roles, setRoles] = useState<GroupRoleInput[]>(
    initial?.roles.map((role) => ({ specialty: role.specialty, slots: role.slots })) ?? []
  );
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedNotice, setLockedNotice] = useState<string | null>(null);
  const submitting = useRef(false);

  const maxMembers = initial?.group.maxMembers ?? GROUP_MAX_MEMBERS;
  const maxSlots = maxMembers - 1;
  const totalSlots = roles.reduce((sum, role) => sum + role.slots, 0);
  const remaining = maxSlots - totalSlots;
  /** Personas que ya ocupan cada perfil: su mínimo. */
  const filledOf = (specialty: Specialty) =>
    initial?.roles.find((role) => role.specialty === specialty)?.filled ?? 0;

  const nameLength = Array.from(name.trim()).length;
  const descriptionLength = Array.from(description.trim()).length;
  const nameError =
    nameLength < GROUP_NAME_MIN || nameLength > GROUP_NAME_MAX
      ? t('El nombre necesita entre {min} y {max} caracteres.', {
          min: GROUP_NAME_MIN,
          max: GROUP_NAME_MAX,
        })
      : undefined;
  const descriptionError =
    descriptionLength < GROUP_DESCRIPTION_MIN || descriptionLength > GROUP_DESCRIPTION_MAX
      ? t('Cuenta el proyecto en al menos {min} caracteres.', { min: GROUP_DESCRIPTION_MIN })
      : undefined;
  const rolesError = roles.length === 0 ? t('Elige al menos un perfil.') : undefined;

  function toggleRole(specialty: Specialty) {
    setLockedNotice(null);
    if (roles.some((role) => role.specialty === specialty)) {
      if (filledOf(specialty) > 0) {
        setLockedNotice(
          t('En {role} ya hay gente. Para quitarlo, antes tendría que salir del grupo.', {
            role: specialtyLabel(specialty),
          })
        );
        return;
      }
      setRoles((current) => current.filter((role) => role.specialty !== specialty));
      return;
    }
    // Sin sitio para una persona más, el chip no añade nada.
    if (remaining < 1) return;
    setRoles((current) => [...current, { specialty, slots: 1 }]);
  }

  function setSlots(specialty: Specialty, slots: number) {
    setRoles((current) =>
      current.map((role) => (role.specialty === specialty ? { ...role, slots } : role))
    );
  }

  async function submit() {
    if (submitting.current) return;
    setShowErrors(true);
    const input = { name, description, roles };
    const invalid = initial
      ? validateGroupUpdate(input, { maxMembers, roles: initial.roles })
      : validateGroupInput(input);
    if (invalid) return;

    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const view = initial
        ? await repositories.groups.update(input)
        : await repositories.groups.create(input);
      refreshMine();
      onSaved(view);
    } catch (cause: unknown) {
      setError(groupErrorMessage(cause));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const submitLabel = editing ? t('Guardar cambios') : t('Crear grupo');
  const busyLabel = editing ? t('Guardando…') : t('Creando…');

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {editing ? null : (
        <ThemedText type="body" themeColor="textSecondary">
          {t(
            'Tú administras el grupo y eres su primer miembro. Di qué perfiles buscáis: verás a quien encaje y esas personas verán tu grupo.'
          )}
        </ThemedText>
      )}

      <Field label={t('Nombre del grupo')} error={showErrors ? nameError : undefined}>
        <TextField
          accessibilityLabel={t('Nombre del grupo')}
          value={name}
          onChangeText={setName}
          maxLength={GROUP_NAME_MAX}
          placeholder={t('Cómo se llama el equipo o el proyecto')}
        />
      </Field>

      <Field label={t('Proyecto')} error={showErrors ? descriptionError : undefined}>
        <TextField
          accessibilityLabel={t('Descripción del proyecto')}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={GROUP_DESCRIPTION_MAX}
          showCount
          placeholder={t('Qué queréis construir y en qué punto está')}
        />
      </Field>

      <Field
        label={t('Perfiles que buscamos')}
        hint={t('Hasta {max} personas entre todos los perfiles. Te quedan {remaining}.', {
          max: maxSlots,
          remaining,
        })}
        error={showErrors ? rolesError : undefined}>
        <ChipRow>
          {SPECIALTY_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              multiple
              accessibilityLabel={t('Perfil: {label}', { label: option.label })}
              selected={roles.some((role) => role.specialty === option.value)}
              onPress={() => toggleRole(option.value)}
            />
          ))}
        </ChipRow>
      </Field>

      {lockedNotice ? (
        <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
          {lockedNotice}
        </ThemedText>
      ) : null}

      {roles.map((role) => {
        const filled = filledOf(role.specialty);
        return (
          <View key={role.specialty} style={styles.slots}>
            <ThemedText type="bodyStrong" style={styles.slotsLabel}>
              {specialtyLabel(role.specialty)}
            </ThemedText>
            {filled > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {filled === 1
                  ? t('Ya hay 1 persona.')
                  : t('Ya hay {count} personas.', { count: filled })}
              </ThemedText>
            ) : null}
            <Stepper
              value={role.slots}
              min={Math.max(1, filled)}
              max={role.slots + remaining}
              onChange={(next) => setSlots(role.specialty, next)}
              formatValue={(value) =>
                value === 1 ? t('1 persona') : t('{value} personas', { value })
              }
            />
          </View>
        );
      })}

      {error ? (
        <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
          {error}
        </ThemedText>
      ) : null}

      <Button
        label={busy ? busyLabel : submitLabel}
        accessibilityLabel={submitLabel}
        disabled={busy}
        onPress={() => void submit()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.four,
    padding: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  slots: { gap: Spacing.two },
  slotsLabel: { flexShrink: 1 },
});
