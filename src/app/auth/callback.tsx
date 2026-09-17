import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthCallback } from '@/features/profile';

/**
 * Ruta `lockin://auth/callback`: donde caen los enlaces de los correos de
 * cuenta (confirmar el email y cambiar la contraseña).
 *
 * No decide nada — el trabajo está en `AuthCallback`, dentro del bloque
 * `perfil`, que es donde se puede probar sin montar el router. Aquí solo se
 * dice a dónde sigue la persona, que es lo único que sabe una ruta.
 */
export default function AuthCallbackRoute() {
  const router = useRouter();

  // `replace` y no `push`: la pantalla del enlace no es un sitio al que se
  // pueda volver con el botón atrás — su código es de un solo uso.
  const goToProfile = useCallback(() => router.replace('/profile'), [router]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <AuthCallback onDone={goToProfile} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
