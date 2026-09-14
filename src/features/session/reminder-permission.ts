/**
 * "Los avisos están denegados", compartido entre quien lo descubre
 * (`SessionReminderSync`, montado en el layout de tabs) y quien lo enseña
 * (`SessionCard`). El descarte se guarda: la spec pide avisarlo una vez.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

export const HINT_DISMISSED_KEY = 'lockin:reminder-hint-dismissed';

let denied = false;
const listeners = new Set<() => void>();

export function setReminderPermissionDenied(value: boolean): void {
  if (denied === value) return;
  denied = value;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getDenied = () => denied;

export function useReminderHint(): { visible: boolean; dismiss: () => void } {
  const isDenied = useSyncExternalStore(subscribe, getDenied, getDenied);
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(HINT_DISMISSED_KEY)
      .then((value) => {
        if (!cancelled) setDismissed(value === '1');
      })
      .catch(() => {
        if (!cancelled) setDismissed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    void AsyncStorage.setItem(HINT_DISMISSED_KEY, '1').catch(() => {});
  }, []);

  return { visible: isDenied && dismissed === false, dismiss };
}
