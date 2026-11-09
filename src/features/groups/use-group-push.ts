/**
 * Activa los avisos push del chat de grupo cuando tiene sentido pedirlos: al
 * estar en un grupo (su pantalla o su chat), no al abrir la app. El permiso se
 * pide una vez por arranque; si ya estaba concedido, solo se refresca el token.
 */

import { useEffect } from 'react';

import { useRepositories } from '@/data';
import { registerForPush } from '@/lib/push';

let requested = false;

/** Solo para tests. */
export function resetGroupPushForTests(): void {
  requested = false;
}

export function useGroupPush(enabled: boolean): void {
  const repositories = useRepositories();
  useEffect(() => {
    if (!enabled) return;
    const prompt = !requested;
    requested = true;
    void registerForPush((token, platform) => repositories.push.register(token, platform), {
      prompt,
    });
  }, [enabled, repositories]);
}
