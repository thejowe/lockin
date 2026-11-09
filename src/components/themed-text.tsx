import { StyleSheet, Text, type TextProps } from 'react-native';

import { ThemeColor, Typography, type TypographyRole } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  /** Rol de la escala tipográfica. Ver `Typography` en `@/constants/theme`. */
  type?: TypographyRole;
  /** Token de color del tema. Por defecto, la tinta principal. */
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'body', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      maxFontSizeMultiplier={LargeRoles.has(type) ? 1.15 : 1.4}
      style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]}
      {...rest}
    />
  );
}

/**
 * Los roles grandes ya son legibles: ampliarlos con el tamaño de letra del
 * sistema rompe tarjetas y cabeceras de alto fijo. El resto escala hasta 1,4×
 * (accesibilidad sin desbordar botones de 56 ni campos de 50).
 */
const LargeRoles: ReadonlySet<TypographyRole> = new Set(['display', 'title', 'timer']);

const styles = StyleSheet.create(Typography);
