import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/** El esquema del sistema no existe en el render estático: nadie a quien suscribirse. */
const subscribe = () => () => {};

/**
 * En web renderizamos estáticamente, así que el HTML se genera sin saber el
 * esquema del usuario. Hasta que el cliente hidrata devolvemos 'light' —
 * si no, el marcado del servidor y el del cliente no coincidirían.
 */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
  const colorScheme = useRNColorScheme();

  return hasHydrated ? colorScheme : 'light';
}
