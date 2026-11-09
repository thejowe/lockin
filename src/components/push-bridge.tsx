/**
 * Engancha los avisos push con la navegación: tocar el aviso de un chat de
 * grupo lo abre. No pinta nada. Va dentro del `Stack` del layout raíz.
 */

import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import { installPushHandlers } from '@/lib/push';

export function PushBridge() {
  const router = useRouter();
  useEffect(() => installPushHandlers((route) => router.push(route as Href)), [router]);
  return null;
}
