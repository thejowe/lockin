/**
 * Engancha los avisos push con la navegación: tocar el aviso de un chat de
 * grupo lo abre. No pinta nada. Va dentro del `Stack` del layout raíz.
 *
 * Además, al arrancar y cada vez que la app vuelve a primer plano comprueba el
 * permiso de notificaciones: si la persona lo ha retirado en los ajustes del
 * sistema, el token de este dispositivo se da de baja en el servidor.
 */

import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useRepositories } from '@/data';
import { forgetPushTokenIfDenied, installPushHandlers } from '@/lib/push';

export function PushBridge() {
  const router = useRouter();
  const repositories = useRepositories();
  useEffect(() => installPushHandlers((route) => router.push(route as Href)), [router]);
  useEffect(() => {
    const check = () =>
      void forgetPushTokenIfDenied((token) => repositories.push.unregister(token));
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => subscription.remove();
  }, [repositories]);
  return null;
}
