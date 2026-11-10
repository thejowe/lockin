import { useRouter } from 'expo-router';

import { useRepositories } from '@/data';
import { AppTour } from '@/features/tour/app-tour';
import { markTourSeen } from '@/features/tour/tour-seen';

/**
 * El mini tutorial: llega aquí quien acaba de crear el perfil (desde
 * `profile-form`) y, una vez, quien abre la app con una cuenta que aún no lo ha
 * visto (lo decide `index`). De aquí se va a `/discover`. `replace` en los dos
 * sentidos: ni el tutorial vuelve atrás ni Descubrir vuelve al tutorial.
 */
export default function TourScreen() {
  const router = useRouter();
  const repositories = useRepositories();

  const finish = () => {
    // Se marca al salir, no al entrar: quien cierra la app a medias lo vuelve a ver.
    void repositories.profiles.getCurrent().then(
      (profile) => markTourSeen(profile?.id),
      () => undefined
    );
    router.replace('/discover');
  };

  return <AppTour onDone={finish} />;
}
