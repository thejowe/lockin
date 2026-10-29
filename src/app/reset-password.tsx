import { Redirect, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ambient-background';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { NewPasswordForm } from '@/features/profile';
import { accountsAvailable } from '@/features/profile/account-gateway';

/**
 * `/reset-password`: la hoja que abre el enlace del correo de recuperación
 * (`auth/callback`). Al guardar o cerrarla, a la puerta de entrada, que decide
 * entre el deck y lo que falte del alta.
 */
export default function ResetPasswordRoute() {
  const router = useRouter();

  if (!accountsAvailable) return <Redirect href="/" />;

  return (
    <Screen ambient="plum">
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {/* El campo enfocado sube por encima del teclado: ver `profile-form.tsx`. */}
        <KeyboardAwareScrollView
          bottomOffset={Spacing.five}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <NewPasswordForm onDone={() => router.replace('/')} />
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
