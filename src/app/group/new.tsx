/**
 * `/group/new`: crear un grupo. Quien lo crea pasa a administrarlo; al terminar
 * vuelve a Descubrir, donde la sección Grupos ya enseña su deck de reclutamiento.
 *
 * Con `GROUP_CREATION_REQUIRES_PREMIUM` encendido, sin Premium esta pantalla
 * lleva al paywall en vez de al formulario (y el servidor lo rechazaría igual).
 */

import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { Screen } from '@/components/ambient-background';
import { LoadingState } from '@/components/state-view';
import { GROUP_CREATION_REQUIRES_PREMIUM } from '@/data';
import { CreateGroupForm } from '@/features/groups';
import { openPaywall, usePremium } from '@/features/premium';
import { RequireVerifiedEmail } from '@/features/profile';
import { t } from '@/i18n';

function NewGroup() {
  const router = useRouter();
  const { quotas, loading } = usePremium();
  const locked = GROUP_CREATION_REQUIRES_PREMIUM && !quotas?.isPremium;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/discover'));

  useEffect(() => {
    if (!GROUP_CREATION_REQUIRES_PREMIUM || loading || !locked) return;
    router.back();
    openPaywall();
  }, [loading, locked, router]);

  if (GROUP_CREATION_REQUIRES_PREMIUM && (loading || locked)) {
    return <LoadingState label={t('Cargando…')} />;
  }

  return (
    <Screen ambient="ember">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <CreateGroupForm onCreated={close} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

export default function NewGroupRoute() {
  return (
    <RequireVerifiedEmail>
      <NewGroup />
    </RequireVerifiedEmail>
  );
}
