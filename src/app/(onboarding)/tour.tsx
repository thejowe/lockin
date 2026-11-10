import { useRouter } from 'expo-router';

import { AppTour } from '@/features/tour/app-tour';

/**
 * El mini tutorial de después del alta: `profile-form` llega aquí tras la
 * entrada animada y de aquí se va a `/discover`. `replace` en los dos sentidos:
 * ni el tutorial vuelve al formulario ni Descubrir vuelve al tutorial.
 */
export default function TourScreen() {
  const router = useRouter();
  return <AppTour onDone={() => router.replace('/discover')} />;
}
