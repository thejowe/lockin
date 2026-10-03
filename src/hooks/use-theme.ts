/**
 * Acceso al tema activo.
 *
 * La app es solo oscura desde la dirección «cristal» (2026-10-03): el esquema
 * del sistema ya no decide nada. Se mantiene la forma del hook para que las
 * pantallas no cambien.
 */

import { Colors, type ThemeName, type ThemePalette } from '@/constants/theme';

/** El esquema activo: siempre oscuro. */
export function useThemeName(): ThemeName {
  return 'dark';
}

/** La paleta del esquema activo. */
export function useTheme(): ThemePalette {
  return Colors[useThemeName()];
}
