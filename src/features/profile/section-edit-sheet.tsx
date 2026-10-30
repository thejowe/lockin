/**
 * Hoja para editar un solo bloque de la ficha (2026-10-30, decisión del
 * usuario): el lápiz de cada bloque del perfil la abre con solo esos campos, en
 * vez de mandar al formulario entero con «Editar perfil».
 *
 * Es el mismo `ProfileForm` con `section`: las reglas, los avisos y el
 * guardado son los de siempre, y el resto de la ficha viaja intacto.
 */

import { Modal, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ProfileForm, type ProfileSection } from './profile-form';

import type { Profile, ProfileInput } from '@/data';

export const SECTION_TITLES: Record<ProfileSection, string> = {
  basics: 'Nombre, edad y ubicación',
  specialties: 'Lo que dominas y lo que buscas',
  work: 'Cómo trabajas',
  prompts: 'Tus respuestas',
  links: 'Enlaces y redes',
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
  const theme = useTheme();

  return (
    <Modal
      visible={section !== null}
      animationType="slide"
      // iOS: la hoja de página del sistema, que se cierra deslizando hacia abajo.
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <SafeAreaView
          style={styles.root}
          edges={Platform.OS === 'ios' ? ['bottom'] : ['top', 'bottom']}>
          {section ? (
            // `key`: cada bloque arranca de la ficha guardada, no de lo que se
            // tecleó y descartó en otro.
            <ProfileForm
              key={section}
              initial={profile}
              section={section}
              submitLabel="Guardar"
              onSubmit={async (input) => {
                await onSave(input);
                onClose();
              }}
              onCancel={onClose}
              header={
                <View style={styles.header}>
                  <ThemedText type="label" themeColor="textSecondary">
                    Editar
                  </ThemedText>
                  <ThemedText type="title">{SECTION_TITLES[section]}</ThemedText>
                </View>
              }
            />
          ) : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    gap: Spacing.two,
    paddingTop: Spacing.four,
  },
});
