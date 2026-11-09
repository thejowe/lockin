/**
 * Formulario de «Crear grupo»: nombre, proyecto y los puestos que se buscan,
 * cada uno con su número de plazas. Quien lo crea pasa a administrarlo y es su
 * primer miembro, así que entre todos los puestos caben como mucho 5 plazas.
 *
 * Las reglas son las de `validateGroupInput` (las mismas que aplica el
 * servidor); aquí solo se traducen a mensajes junto a cada campo.
 */

import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  GROUP_DESCRIPTION_MAX,
  GROUP_DESCRIPTION_MIN,
  GROUP_MAX_ROLE_SLOTS,
  GROUP_NAME_MAX,
  GROUP_NAME_MIN,
  useRefreshQuery,
  useRepositories,
  validateGroupInput,
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
  const repositories = useRepositories();
  const refreshMine = useRefreshQuery(MY_GROUP_QUERY);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [roles, setRoles] = useState<GroupRoleInput[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  const totalSlots = roles.reduce((sum, role) => sum + role.slots, 0);
  const remaining = GROUP_MAX_ROLE_SLOTS - totalSlots;

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
  const rolesError = roles.length === 0 ? t('Elige al menos un puesto.') : undefined;

  function toggleRole(specialty: Specialty) {
    setRoles((current) => {
      if (current.some((role) => role.specialty === specialty)) {
        return current.filter((role) => role.specialty !== specialty);
      }
      // Sin sitio para una plaza más, el chip no añade nada.
      return remaining < 1 ? current : [...current, { specialty, slots: 1 }];
    });
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
    if (validateGroupInput(input)) return;

    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const view = await repositories.groups.create(input);
      refreshMine();
      onCreated(view);
    } catch (cause: unknown) {
      setError(groupErrorMessage(cause));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ThemedText type="body" themeColor="textSecondary">
        {t(
          'Tú administras el grupo y eres su primer miembro. Di qué puestos buscas: verás a quien encaje y esas personas verán tu grupo.'
        )}
      </ThemedText>

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
        label={t('Puestos que buscas')}
        hint={t('Hasta {max} plazas entre todos los puestos. Te quedan {remaining}.', {
          max: GROUP_MAX_ROLE_SLOTS,
          remaining,
        })}
        error={showErrors ? rolesError : undefined}>
        <ChipRow>
          {SPECIALTY_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              multiple
              accessibilityLabel={t('Puesto: {label}', { label: option.label })}
              selected={roles.some((role) => role.specialty === option.value)}
              onPress={() => toggleRole(option.value)}
            />
          ))}
        </ChipRow>
      </Field>

      {roles.map((role) => (
        <View key={role.specialty} style={styles.slots}>
          <ThemedText type="bodyStrong" style={styles.slotsLabel}>
            {specialtyLabel(role.specialty)}
          </ThemedText>
          <Stepper
            value={role.slots}
            min={1}
            max={role.slots + remaining}
            onChange={(next) => setSlots(role.specialty, next)}
            formatValue={(value) => (value === 1 ? t('1 plaza') : t('{value} plazas', { value }))}
          />
        </View>
      ))}

      {error ? (
        <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
          {error}
        </ThemedText>
      ) : null}

      <Button
        label={busy ? t('Creando…') : t('Crear grupo')}
        accessibilityLabel={t('Crear grupo')}
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
