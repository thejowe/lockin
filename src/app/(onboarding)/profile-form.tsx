import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ambient-background';
import { WelcomeSplash } from '@/components/welcome-splash';
import { useRepositories, type ProfileInput } from '@/data';
import {
  ProfileWizard,
  TermsAcceptance,
  useRegistrationGate,
  useTermsGate,
} from '@/features/profile';
import { Board } from '@/features/profile/board';
import { MyProjects } from '@/features/profile/projects';
import { WizardScreen } from '@/features/profile/wizard';
import { t } from '@/i18n';

/**
 * Último paso del onboarding: crear el perfil, pregunta a pregunta
 * (`ProfileWizard`, con barra de progreso y «Omitir» en lo opcional) y, al
 * terminar, la entrada animada (`WelcomeSplash`) y el mini tutorial (`/tour`). La tab Perfil edita con el
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

  // Las fotos y proyectos publicados necesitan el perfil y su avatar ya aprobados.
  const [entering, setEntering] = useState(false);
  const [media, setMedia] = useState<{
    ownerId: string;
    name: string;
    step: 'board' | 'projects';
    total: number;
  } | null>(null);

  async function handleSubmit(input: ProfileInput, photoUri: string | null, total = 17) {
    // El modo lo guarda la bienvenida, pero no siempre se pasa por ella con esta
    // sesión: con Google/Apple, si Android mató el proceso con el navegador
    // abierto, la sesión nueva nace en `/auth/callback`. Sin modo, `isOnboarded()`
    // seguiría en `false` y cada arranque volvería aquí.
    await repositories.session.setActiveMode('par');
    const profile = await repositories.profiles.saveCurrent(input);
    // La foto es obligatoria y solo se sube con el perfil ya creado. Si el
    // servidor la rechaza, el error vuelve al paso de la foto (guardar el
    // perfil es idempotente) y no se entra a la app sin ella.
    if (photoUri) await repositories.profiles.setAvatarPhoto(photoUri);
    setMedia({ ownerId: profile.id, name: profile.name, step: 'board', total });
  }

  if (gate === 'checking') return null;
  if (gate === 'required') return <Redirect href="/register" />;
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
        <View style={media ? styles.hidden : styles.root}>
          <ProfileWizard
            withPhoto
            extraSteps={2}
            submitLabel={t('Continuar')}
            onSubmit={handleSubmit}
          />
        </View>
        {media ? (
          <WizardScreen
            step={media.step === 'board' ? media.total - 1 : media.total}
            total={media.total}
            title={media.step === 'board' ? t('Sobre mí') : t('Tus proyectos')}
            primaryLabel={media.step === 'board' ? t('Continuar') : t('Crear perfil')}
            onBack={() =>
              media.step === 'board' ? setMedia(null) : setMedia({ ...media, step: 'board' })
            }
            onPrimary={() =>
              media.step === 'board' ? setMedia({ ...media, step: 'projects' }) : setEntering(true)
            }
            onSkip={() =>
              media.step === 'board' ? setMedia({ ...media, step: 'projects' }) : setEntering(true)
            }>
            {media.step === 'board' ? (
              <Board ownerId={media.ownerId} ownerName={media.name} editable hideTitle />
            ) : (
              <MyProjects ownerId={media.ownerId} wizard />
            )}
          </WizardScreen>
        ) : null}
      </SafeAreaView>
      {/* Encima y no en su lugar: si el guardado falla, el asistente sigue como estaba. */}
      {entering ? (
        <View style={StyleSheet.absoluteFill}>
          {/* `replace`: una vez creado el perfil, volver al formulario no tiene sentido.
              Antes de Descubrir, el mini tutorial de lo que hay en la app (`/tour`). */}
          <WelcomeSplash ready onEnter={() => router.replace('/tour')} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hidden: { display: 'none' },
  root: {
    flex: 1,
  },
});
