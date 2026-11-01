import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ambient-background';
import { WelcomeSplash } from '@/components/welcome-splash';
import { useQuery, useRepositories, type ProfileInput } from '@/data';
import {
  ProfileWizard,
  TermsAcceptance,
  useRegistrationGate,
  useTermsGate,
} from '@/features/profile';
import { clearSignupBasics, readSignupBasics } from '@/features/profile/signup-draft';

/**
 * Último paso del onboarding: crear el perfil, pregunta a pregunta
 * (`ProfileWizard`, con barra de progreso y «Omitir» en lo opcional) y, al
 * terminar, la entrada animada (`WelcomeSplash`). La tab Perfil edita con el
 * formulario entero (`ProfileForm`). Aquí
 * arranca con nombre, edad y ubicación de «Sobre ti», el primer paso del alta
 * (`signup-draft.ts`), y ese borrador se borra al crear el perfil. No pregunta
 * qué busca la persona: desde el 2026-10-12 el producto es solo buscar
 * cofundador.
 *
 * Con el registro obligatorio (2026-09-20) tampoco se llega aquí sin cuenta: la
 * puerta manda a `/register`, igual que `mode`, para que una URL directa no la
 * salte.
 */
export default function ProfileFormScreen() {
  const router = useRouter();
  const repositories = useRepositories();

  const gate = useRegistrationGate();
  const terms = useTermsGate();

  // Al enviar el último paso se enseña ya la entrada animada y el perfil se
  // guarda por debajo: entra cuando acaba de guardarse (y de sonar la animación,
  // o antes si se toca). Si el guardado falla, se vuelve al formulario.
  const [entering, setEntering] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(input: ProfileInput) {
    setEntering(true);
    try {
      // El modo lo guarda la bienvenida, pero no siempre se pasa por ella con esta
      // sesión: con Google/Apple, si Android mató el proceso con el navegador
      // abierto, la sesión nueva nace en `/auth/callback`. Sin modo, `isOnboarded()`
      // seguiría en `false` y cada arranque volvería aquí.
      await repositories.session.setActiveMode('par');
      await repositories.profiles.saveCurrent(input);
      await clearSignupBasics();
      setSaved(true);
    } catch (cause) {
      setEntering(false);
      throw cause;
    }
  }

  if (gate === 'checking') return null;
  if (gate === 'required') return <Redirect href="/register" />;
  if (gate === 'phone') return <Redirect href="/phone" />;
  if (terms.gate === 'checking') return null;

  // Sin Términos y Normas aceptados no se publica perfil.
  if (terms.gate === 'required') {
    return (
      <Screen ambient="plum">
        <SafeAreaView style={styles.root} edges={['top']}>
          <TermsAcceptance onAccepted={terms.refresh} />
        </SafeAreaView>
      </Screen>
    );
  }

  return (
    <Screen ambient="plum">
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <SeededProfileWizard onSubmit={handleSubmit} />
      </SafeAreaView>
      {/* Encima y no en su lugar: si el guardado falla, el asistente sigue como estaba. */}
      {entering ? (
        <View style={StyleSheet.absoluteFill}>
          {/* `replace`: una vez creado el perfil, volver al onboarding no tiene sentido. */}
          <WelcomeSplash ready={saved} onEnter={() => router.replace('/discover')} />
        </View>
      ) : null}
    </Screen>
  );
}

/**
 * El asistente, una vez leído el borrador de «Sobre ti». Aparte para que la
 * lectura no empiece hasta que la puerta y los Términos dejan pasar: con ella
 * arriba, la pantalla se repintaría (y repetiría su `Redirect`) al resolverla.
 */
function SeededProfileWizard({ onSubmit }: { onSubmit: (input: ProfileInput) => Promise<void> }) {
  const { data: basics, loading } = useQuery('signup:basics', readSignupBasics);
  if (loading) return null;
  return <ProfileWizard submitLabel="Crear perfil" seed={basics} onSubmit={onSubmit} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
