import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ambient-background';
import { useRepositories } from '@/data';
import { AuthCallback, authLinkFromParams } from '@/features/profile';
import { accountsAvailable, currentSignInProvider } from '@/features/profile/account-gateway';
import { hasPendingPassword } from '@/features/profile/pending-password';

/**
 * Ruta `cofounder://auth/callback`: donde caen los enlaces de los correos de
 * cuenta (confirmar el email y cambiar la contraseña).
 *
 * No decide nada — el trabajo está en `AuthCallback`, dentro del bloque
 * `perfil`, que es donde se puede probar sin montar el router. Aquí solo se
 * dice a dónde sigue la persona, que es lo único que sabe una ruta.
 *
 * Depende de quién sea: con perfil viene de Perfil (asegurar la cuenta o
 * cambiar la contraseña) y vuelve allí; sin perfil está en pleno alta, y lo que
 * le falta es la contraseña, que se pone en `/register` — mandarla a
 * `/profile` la dejaría en una tab vacía, con la puerta del registro a medias.
 * Con una contraseña elegida antes de confirmar (`pending-password.ts`) también
 * va a `/register`, tenga perfil o no: es allí donde se aplica, y una cuenta con
 * perfil que asciende la eligió en ese mismo formulario.
 */
export default function AuthCallbackRoute() {
  const router = useRouter();
  const repositories = useRepositories();
  // Del router y no de `Linking.useURL()`: ver la cabecera de `AuthCallback`.
  const params = useLocalSearchParams();
  const url = useMemo(() => authLinkFromParams(params), [params]);

  // `replace` y no `push`: la pantalla del enlace no es un sitio al que se
  // pueda volver con el botón atrás — su código es de un solo uso.
  const goNext = useCallback(() => {
    Promise.all([
      repositories.session.isOnboarded(),
      hasPendingPassword(),
      accountsAvailable ? currentSignInProvider() : Promise.resolve(null),
    ]).then(
      ([onboarded, pending, provider]) => {
        // Entrar con Google o Apple no pasa por contraseña: a la puerta de
        // entrada, igual que la bienvenida, para que haya una sola decisión.
        if (!pending && (provider === 'google' || provider === 'apple')) {
          router.replace('/');
          return;
        }
        router.replace(onboarded && !pending ? '/profile' : '/register');
      },
      // Sin poder saber si hay perfil, la puerta de entrada ya sabe enseñar el fallo.
      () => router.replace('/')
    );
  }, [router, repositories]);

  return (
    <Screen ambient="plum">
      <SafeAreaView style={styles.root} edges={['top']}>
        <AuthCallback url={url} onDone={goNext} />
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
