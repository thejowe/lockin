import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ambient-background';
import { BackArrow } from '@/components/back-arrow';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { UnblockRequestForm } from '@/features/profile';
import { accountsAvailable } from '@/features/profile/account-gateway';

/**
 * «Solicitar desbloqueo»: el correo de una cuenta eliminada queda bloqueado y
 * aquí se pide recuperarlo explicando el motivo. Se llega desde el aviso de
 * «correo bloqueado» al entrar o registrarse (`?email=` lo trae relleno).
 */
export default function UnblockScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();

  if (!accountsAvailable) return <Redirect href="/" />;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen ambient="ember">
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <BackArrow onPress={close} />
        <KeyboardAwareScrollView
          bottomOffset={Spacing.five}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <UnblockRequestForm
            initialEmail={typeof email === 'string' ? email : ''}
            onClose={close}
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
