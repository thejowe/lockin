import { Redirect, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ambient-background';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { PhoneStep } from '@/features/profile';
import { registrationRequired } from '@/features/profile/account-gateway';

/**
 * «Tu teléfono»: puerta del móvil obligatorio para quien ya tiene la cuenta
 * confirmada pero sin número (entró con un proveedor externo, o es anterior al
 * requisito). `useRegistrationGate` devuelve `phone` y manda aquí.
 */
export default function PhoneScreen() {
  const router = useRouter();
  if (!registrationRequired) return <Redirect href="/" />;

  return (
    <Screen ambient="ember">
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <KeyboardAwareScrollView
          bottomOffset={Spacing.five}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <PhoneStep onDone={() => router.replace('/')} />
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
