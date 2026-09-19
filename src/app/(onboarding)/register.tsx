import { Redirect, useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { RegisterForm } from '@/features/profile';
import { registrationRequired } from '@/features/profile/account-gateway';

/**
 * «Crear cuenta»: la puerta del alta, obligatoria desde el 2026-09-20.
 *
 * `mode` y `profile-form` mandan aquí mientras la cuenta no tenga el email
 * confirmado. Sin capa de cuentas (mock, o la puerta apagada en la compilación)
 * no hay nada que crear: quien llegara por una URL vuelve al principio.
 *
 * Al terminar, el onboarding sigue por `/mode`, con `replace` porque el
 * registro no es un sitio al que se vuelva con el botón atrás. «Ya tengo
 * cuenta» sí es un `push`: desde ahí se puede volver.
 */
export default function RegisterScreen() {
  const router = useRouter();

  if (!registrationRequired) return <Redirect href="/mode" />;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <RegisterForm
          onDone={() => router.replace('/mode')}
          onSignIn={() => router.push('/sign-in')}
        />
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
