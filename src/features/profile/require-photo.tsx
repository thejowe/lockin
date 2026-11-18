import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';

import { LoadingState } from '@/components/state-view';
import { useQuery, useRepositories, type Profile } from '@/data';
import { t } from '@/i18n';

/**
 * Puerta de foto (decisión del usuario del 2026-11-18): sin una foto de perfil
 * aprobada no se entra a las pestañas. Igual que `RequireVerifiedEmail`, vale
 * también para las cuentas anteriores a la foto obligatoria.
 *
 * La foto solo existe cuando `moderate-avatar` la aprueba (`avatar_url` lo
 * escribe esa función), así que «tiene foto» es «tiene una foto aprobada».
 * Si la lectura del perfil falla la puerta no cierra: un corte de red no debe
 * sacar a nadie de la app, y las pestañas ya enseñan su propio error.
 */
export const CURRENT_PROFILE_KEY = 'profile:current';

export type PhotoGate = 'checking' | 'open' | 'required' | 'no-profile';

export function hasApprovedPhoto(profile: Profile): boolean {
  return Boolean(profile.avatar.imageUrl || profile.avatar.hasPhoto);
}

export function usePhotoGate(): { gate: PhotoGate; refresh: () => void } {
  const { profiles } = useRepositories();
  const { data, loading, error, refresh } = useQuery(CURRENT_PROFILE_KEY, () =>
    profiles.getCurrent()
  );
  if (loading) return { gate: 'checking', refresh };
  if (error) return { gate: 'open', refresh };
  // Sin perfil (lectura correcta): que decida el índice, que lleva al alta.
  if (!data) return { gate: 'no-profile', refresh };
  return { gate: hasApprovedPhoto(data) ? 'open' : 'required', refresh };
}

export function RequirePhoto({ children }: { children: ReactNode }) {
  const { gate } = usePhotoGate();
  if (gate === 'checking') return <LoadingState label={t('Comprobando tu cuenta…')} />;
  if (gate === 'required') return <Redirect href="/photo" />;
  if (gate === 'no-profile') return <Redirect href="/" />;
  return <>{children}</>;
}
