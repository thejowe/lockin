import type { ReactNode } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { glassStyle } from './glass';
import { Icon } from './icon';
import { Control, Opacity, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

export function requestClose(dirty: boolean, close: () => void) {
  if (!dirty) return close();
  const title = t('¿Descartar los cambios?');
  if (Platform.OS === 'web') {
    if (window.confirm(title)) close();
    return;
  }
  Alert.alert(title, undefined, [
    { text: t('Cancelar'), style: 'cancel' },
    { text: t('Descartar'), style: 'destructive', onPress: close },
  ]);
}
type Props = { onPress: () => void; disabled?: boolean };
export function CloseButton({ onPress, disabled = false }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('Cerrar')}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.target,
        { opacity: disabled ? Opacity.disabled : pressed ? Opacity.pressed : 1 },
      ]}>
      <View style={[glassStyle(theme, { radius: Radii.pill }), styles.disc]}>
        <Icon name="close" size={18} color={theme.text} />
      </View>
    </Pressable>
  );
}
export function CloseHeader({ children, ...props }: Props & { children?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.title}>{children}</View>
      <View style={styles.closeInHeader}>
        <CloseButton {...props} />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { flex: 1 },
  closeInHeader: { alignSelf: 'flex-start' },
  target: {
    alignItems: 'center',
    justifyContent: 'center',
    width: Control.minTouch,
    height: Control.minTouch,
    alignSelf: 'flex-end',
  },
  disc: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
