/**
 * Globo rojo con el número de mensajes sin leer. Sin nada pendiente no pinta
 * nada. A partir de 100 dice «99+» para no crecer sin fin.
 */

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

const MAX_SHOWN = 99;

export function unreadLabel(count: number): string {
  return count > MAX_SHOWN ? `${MAX_SHOWN}+` : String(count);
}

export function UnreadBadge({
  count,
  size = 'regular',
  style,
}: {
  count: number;
  /** `small` para encima de un icono (la barra de pestañas); `regular` en una fila. */
  size?: 'small' | 'regular';
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  if (count <= 0) return null;

  const small = size === 'small';
  return (
    <View
      testID="unread-badge"
      // El número ya lo dice la etiqueta de quien lo lleva; leerlo aparte repetiría.
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.root,
        small ? styles.small : styles.regular,
        { backgroundColor: theme.unread, borderColor: theme.background },
        style,
      ]}>
      <Text
        allowFontScaling={false}
        style={[
          styles.label,
          small ? styles.labelSmall : styles.labelRegular,
          { color: theme.onUnread },
        ]}>
        {unreadLabel(count)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 1.5,
  },
  regular: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
  },
  label: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    textAlign: 'center',
  },
  labelSmall: {
    fontSize: 10,
    lineHeight: 12,
  },
  labelRegular: {
    fontSize: 12,
    lineHeight: 14,
  },
});
