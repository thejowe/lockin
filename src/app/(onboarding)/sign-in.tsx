import { Redirect, useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { SignInForm } from '@/features/profile';
import { accountsAvailable } from '@/features/profile/account-gateway';

/**
 * «Ya tengo cuenta»: la salida opcional del onboarding para quien ya tiene una.
 *
 * Sin capa de cuentas (mock en memoria, sin credenciales de Supabase) no hay
 * nada a lo que entrar: el enlace ni se ofrece en `mode.tsx`, y si alguien
 * llegara aquí por una URL, vuelve al principio en vez de pintar un formulario
 * que reventaría al usarlo.
 *
 * Al entrar, la persona no va a un sitio concreto: se le manda a la puerta de
 * entrada (`/`), que relee `session:onboarded` con la sesión nueva y decide —
 * perfil, a las tabs; sin perfil, al onboarding—. `replace` porque volver atrás
 * a este formulario con otra sesión abierta no tiene sentido.
 */
export default function SignInScreen() {
  const router = useRouter();

  if (!accountsAvailable) return <Redirect href="/mode" />;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SignInForm onSignedIn={() => router.replace('/')} onCancel={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
