import { Redirect } from 'expo-router';

import { useQuery, useRepositories } from '@/data';

/**
 * Puerta de entrada. Decide, con la capa de datos, si el usuario va al
 * onboarding o directamente a las tabs. No pinta interfaz propia.
 */
export default function IndexRoute() {
  const repositories = useRepositories();
  const { data: onboarded, loading } = useQuery('session:onboarded', () =>
    repositories.session.isOnboarded()
  );

  // El splash sigue visible mientras resolvemos: no parpadeamos una pantalla vacía.
  if (loading) return null;

  return <Redirect href={onboarded ? '/discover' : '/mode'} />;
}
