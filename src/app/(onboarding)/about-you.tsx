import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ambient-background';
import { useQuery } from '@/data';
import { AboutYouForm, ProviderButtons } from '@/features/profile';
import { registrationRequired } from '@/features/profile/account-gateway';
import { readSignupBasics, saveSignupBasics } from '@/features/profile/signup-draft';

/**
 * Primer paso del alta: nombre, fecha de nacimiento y dónde vives, de uno en uno.
 *
 * Sigue a la cuenta (`/register`) si la compilación la exige y, sin capa de
 * cuentas (mock), directamente al perfil. Lo tecleado queda en el borrador del
 * alta (`signup-draft.ts`) para que el formulario de perfil arranque relleno, y
 * también para que volver aquí desde la cuenta no lo borre.
 */
export default function AboutYouScreen() {
  const router = useRouter();
  const { data: basics, loading } = useQuery('signup:basics', readSignupBasics);

  if (loading) return null;

  return (
    <Screen ambient="ember">
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <AboutYouForm
          initial={basics}
          onBack={router.canGoBack() ? () => router.back() : undefined}
          onNext={async (next) => {
            await saveSignupBasics(next);
            router.push(registrationRequired ? '/register' : '/profile-form');
          }}
          // Registrarse con Google o Apple sin pasar por aquí: los datos los
          // pide igualmente el formulario de perfil, y con cuenta ya existente
          // `/` lleva directa al deck.
          alternatives={
            registrationRequired ? <ProviderButtons onSignedIn={() => router.replace('/')} /> : null
          }
        />
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
