/**
 * Hoja para editar un solo bloque de la ficha (2026-10-30, decisión del
 * usuario): el lápiz de cada bloque del perfil la abre con solo esos campos, en
 * vez de mandar al formulario entero con «Editar perfil».
 *
 * Es el mismo `ProfileForm` con `section`: las reglas, los avisos y el
 * guardado son los de siempre, y el resto de la ficha viaja intacto.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { ProfileForm, type ProfileSection } from './profile-form';

import type { Profile, ProfileInput } from '@/data';
import { t } from '@/i18n';

export const SECTION_TITLES: Record<ProfileSection, string> = {
  get basics() {
    return t('Nombre, edad y ubicación');
  },
  get specialties() {
    return t('Lo que dominas y lo que buscas');
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

export function SectionEditSheet({
  profile,
  section,
  onSave,
  onClose,
}: {
  profile: Profile;
  /** El bloque abierto, o `null` con la hoja cerrada. */
  section: ProfileSection | null;
  /** Guarda la ficha entera. Si lanza, la hoja enseña el error y no se cierra. */
  onSave: (input: ProfileInput) => Promise<void>;
  onClose: () => void;
}) {
  if (!section) return null;
  return (
    <ProfileForm
      key={section}
      initial={profile}
      section={section}
      submitLabel={t('Guardar')}
      onSubmit={async (input) => {
        await onSave(input);
        onClose();
      }}
      onCancel={onClose}
      header={
        <View style={styles.header}>
          <ThemedText type="label" themeColor="textSecondary">
            {t('Editar')}
          </ThemedText>
          <ThemedText type="title">{SECTION_TITLES[section]}</ThemedText>
        </View>
      }
    />
  );
}
const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
  },
});
