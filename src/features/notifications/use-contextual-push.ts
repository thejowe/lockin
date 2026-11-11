import { useEffect } from 'react';

import { useRepositories } from '@/data';
import { getLocale } from '@/i18n';
import { registerForPush } from '@/lib/push';

let requested = false;
export function resetContextualPushForTests(): void {
  requested = false;
}

/** Likes visibles, match recién creado o entrada en grupo. Nunca en bienvenida. */
export function useContextualPush(enabled: boolean): void {
  const repositories = useRepositories();
  useEffect(() => {
    if (!enabled) return;
    const prompt = !requested;
    requested = true;
    void registerForPush(
      (token, platform) => repositories.push.register(token, platform, getLocale()),
      {
        prompt,
        remove: (token) => repositories.push.unregister(token),
      }
    );
  }, [enabled, repositories]);
}
