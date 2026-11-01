/**
 * Acceso al tema activo.
 *
 * La app es solo oscura desde la dirección «cristal» (2026-10-03): el esquema
 * del sistema ya no decide nada. Se mantiene la forma del hook para que las
 * pantallas no cambien.
 */

import { createContext, useContext } from 'react';

import { Colors, type ThemeName, type ThemePalette } from '@/constants/theme';

/** Una paleta que sustituye a la normal en un subárbol (el paywall sobre azul). */
export const ThemeOverride = createContext<ThemePalette | null>(null);

/** El esquema activo: siempre oscuro. */
export function useThemeName(): ThemeName {
  return 'dark';
}

/** La paleta del esquema activo, o la que imponga un `ThemeOverride`. */
export function useTheme(): ThemePalette {
  const override = useContext(ThemeOverride);
  const base = Colors[useThemeName()];
  return override ?? base;
}
