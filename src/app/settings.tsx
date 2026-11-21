import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ambient-background';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { AccountSection, LanguageSection, LegalLinks, PersonalInfo } from '@/features/profile';
import { NotificationSection } from '@/features/profile/notification-section';

/**
 * Ajustes de la cuenta: lo que no se enseña a la gente (desde las tres rayas del
 * perfil, 2026-11-01). Información personal, plan y facturación, contraseña,
 * legal y las salidas (cerrar sesión, eliminar la cuenta).
 */
export default function SettingsScreen() {
  const router = useRouter();

  // Ajustes es una ruta apilada y no pasa por la puerta del correo: sin sesión
  // se queda pintada con solo el idioma. Se vacía la pila (para que atrás no
  // vuelva a pantallas con datos) y se arranca de nuevo: `/` decide la bienvenida.
  function backToStart() {
    if (router.canDismiss()) router.dismissAll();
    router.replace('/');
  }

  return (
    <Screen ambient="plum">
      <SafeAreaView style={styles.root} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <LanguageSection />
          <NotificationSection />
          <AccountSection
            personalInfo={<PersonalInfo />}
            onDeleted={backToStart}
            onSignedOut={backToStart}>
            <LegalLinks />
          </AccountSection>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
