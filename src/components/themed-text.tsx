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
    <Text style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]} {...rest} />
  );
}

const styles = StyleSheet.create(Typography);
