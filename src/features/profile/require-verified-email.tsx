/**
 * La puerta del correo para toda la app: sin email confirmado no se entra.
 *
 * `useRegistrationGate` ya decidía el alta (`mode`, `profile-form`); esto la
 * lleva a lo que hay detrás: las pestañas y las rutas apiladas con datos.
 * Cubre a quien ya tenía perfil de antes del registro obligatorio (sesión
 * anónima) y a quien abre una ruta directa. Esas cuentas van a `/register`,
 * donde ascienden la sesión con email y contraseña y conservan perfil y matches.
 *
 * Mientras se pregunta al servidor no se pinta nada de lo de dentro, para que
 * ni un fotograma de datos ajenos salga antes de saber si se puede pasar.
 */

import { Redirect } from 'expo-router';

import { LoadingState } from '@/components/state-view';
import { useQuery } from '@/data';

import { readAccountState } from './account-gateway';

import { useRegistrationGate } from './use-registration-gate';

import type { ReactNode } from 'react';

export function RequireVerifiedEmail({ children }: { children: ReactNode }) {
  const gate = useRegistrationGate();
  const { data: account } = useQuery('account:state', readAccountState);

  if (gate === 'checking') return <LoadingState label="Comprobando tu cuenta…" />;
  // Sin sesión (acaba de cerrarla) se vuelve a la inicial, con el logo y las dos
  // salidas; solo quien tiene una cuenta a medias va a asegurarla en `/register`.
  if (gate === 'required') {
    return <Redirect href={account?.kind === 'none' ? '/mode' : '/register'} />;
  }
  if (gate === 'phone') return <Redirect href="/phone" />;

  return <>{children}</>;
}
