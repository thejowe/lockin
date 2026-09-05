/**
 * Acceso al tema activo.
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors, type ThemeName, type ThemePalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** El esquema activo, normalizado: si el sistema no lo declara, claro. */
export function useThemeName(): ThemeName {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

/** La paleta de marca del esquema activo. */
export function useTheme(): ThemePalette {
  return Colors[useThemeName()];
}
