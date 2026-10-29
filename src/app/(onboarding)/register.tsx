import { Redirect, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ambient-background';
import { BackArrow } from '@/components/back-arrow';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useQuery, useRepositories } from '@/data';
import { RegisterForm } from '@/features/profile';
import { registrationRequired } from '@/features/profile/account-gateway';

/**
 * «Crear cuenta»: la puerta del alta, obligatoria desde el 2026-09-20.
 *
 * `mode` y `profile-form` mandan aquí mientras la cuenta no tenga el email
 * confirmado. Sin capa de cuentas (mock, o la puerta apagada en la compilación)
 * no hay nada que crear: quien llegara por una URL vuelve al principio.
 *
 * Al terminar vuelve a `/`, que decide: `/profile-form` si no hay perfil y
 * `/discover` si ya lo había (cuenta anterior al registro obligatorio,
 * ascendida). En el alta normal es el paso 2 (cuenta) y 3 (verificar el correo)
 * de cuatro, tras «Sobre ti»; a quien asciende una cuenta con perfil no se le
 * cuentan pasos. Con
 * `replace` porque el
 * registro no es un sitio al que se vuelva con el botón atrás. «Ya tengo
 * cuenta» sí es un `push`: desde ahí se puede volver.
 */
export default function RegisterScreen() {
  if (!registrationRequired) return <Redirect href="/mode" />;
  return <Register />;
}

/** Aparte para no preguntar por el perfil cuando la ruta solo va a redirigir. */
function Register() {
  const router = useRouter();
  const repositories = useRepositories();
  const { data: onboarded, loading } = useQuery('session:onboarded', () =>
    repositories.session.isOnboarded()
  );

  if (loading) return null;

  return (
    <Screen ambient="ember">
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {router.canGoBack() ? <BackArrow onPress={() => router.back()} /> : null}
        {/* El campo enfocado sube por encima del teclado: ver `profile-form.tsx`. */}
        <KeyboardAwareScrollView
          bottomOffset={Spacing.five}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <RegisterForm
            onDone={() => router.replace('/')}
            onSignIn={() => router.push('/sign-in')}
            steps={onboarded ? undefined : { account: 'Paso 2 de 4', confirm: 'Paso 3 de 4' }}
          />
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </Screen>
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
