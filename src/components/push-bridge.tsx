/**
 * Engancha los avisos con la navegación, registra sin diálogo si ya hay permiso
 * y sincroniza idioma y actividad de la sesión existente. No pinta nada.
 *
 * Además, al arrancar y cada vez que la app vuelve a primer plano comprueba el
 * permiso de notificaciones: si la persona lo ha retirado en los ajustes del
 * sistema, el token de este dispositivo se da de baja en el servidor.
 */

import { usePathname, useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useRepositories } from '@/data';
import {
  forgetPushTokenIfDenied,
  installPushHandlers,
  registerForPush,
  setActivePushRoute,
  routeOf,
} from '@/lib/push';
import { useLocale } from '@/i18n';

export function PushBridge() {
  const router = useRouter();
  const repositories = useRepositories();
  const locale = useLocale();
  const path = usePathname();
  const lastTouch = useRef({ userId: '', at: 0 });
  useEffect(() => {
    return setActivePushRoute(routeOf({ url: path === '/matches' ? '/(tabs)/matches' : path }));
  }, [path]);
  useEffect(() => installPushHandlers((route) => router.push(route as Href)), [router]);
  useEffect(() => {
    let disposed = false;
    const check = async () => {
      await forgetPushTokenIfDenied((token) => repositories.push.unregister(token));
      try {
        const userId = await repositories.push.currentAccountId();
        if (!userId || disposed) {
          lastTouch.current = { userId: '', at: 0 };
          return;
        }
        // Los RPC de actividad/idioma no abren sesiones. Sin cuenta, se termina aquí.
        await repositories.push.setLocale(locale);
        if (disposed) return;
        if (
          lastTouch.current.userId !== userId ||
          Date.now() - lastTouch.current.at >= 15 * 60_000
        ) {
          lastTouch.current = { userId, at: Date.now() };
          try {
            await repositories.push.touchLastActive();
          } catch (error) {
            lastTouch.current = { userId: '', at: 0 };
            throw error;
          }
        }
        if (disposed) return;
        await registerForPush(
          (token, platform) => repositories.push.register(token, platform, locale),
          {
            prompt: false,
            remove: (token) => repositories.push.unregister(token),
          }
        );
      } catch {
        /* Sin sesión, sin red o backend anterior a la migración: reintentar al volver. */
      }
    };
    void check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => {
      disposed = true;
      subscription.remove();
    };
  }, [repositories, locale, path]);
  return null;
}
