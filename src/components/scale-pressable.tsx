/**
 * `Pressable` con el press state compartido (`usePressScale`): cede un 3 % bajo
 * el dedo y vuelve con muelle.
 *
 * El `Pressable` lleva solo el comportamiento (rol, etiqueta, `onPress`…); la
 * forma visual va en `style`, que se aplica al contenedor animado de dentro, y
 * `pressedStyle` se suma mientras el dedo está encima. `collapsable={false}`:
 * que Fabric no aplane la vista al cambiar de estado (ver `button.tsx`).
 */

import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';

import { usePressScale } from '@/hooks/use-press-scale';

import type { PressableProps, StyleProp, ViewStyle } from 'react-native';

export function ScalePressable({
  style,
  pressedStyle,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const press = usePressScale();
  return (
    <Pressable
      {...rest}
      onPressIn={(event) => {
        press.onPressIn();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        press.onPressOut();
        onPressOut?.(event);
      }}>
      {({ pressed }) => (
        <Animated.View collapsable={false} style={[style, pressed && pressedStyle, press.style]}>
          {children}
        </Animated.View>
      )}
    </Pressable>
  );
}
