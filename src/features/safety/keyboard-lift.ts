import { useCallback, useRef, useState } from 'react';
import type { View } from 'react-native';
import { useKeyboardState, useWindowDimensions } from 'react-native-keyboard-controller';

/**
 * Cuánto hay que subir el pie de acciones del reporte para que quede sobre el
 * teclado.
 *
 * Con edge-to-edge (Android 15+) `adjustResize` no actúa: el teclado se pinta
 * encima de la ventana sin encogerla. La tarjeta del reporte no llega al borde
 * inferior de la ventana (debajo queda la barra de tabs), así que el teclado
 * solo tapa la parte que excede ese hueco, no su altura entera. Es la misma
 * trampa que en el chat (ver `features/chat/keyboard-offset.ts`): la premisa
 * «la vista llega al borde inferior» no se cumple, y `onLayout` no da posición
 * absoluta, por lo que el borde se mide con `measureInWindow`.
 *
 * Sin medida fiable del borde se asume lo conservador: levantar la altura
 * entera del teclado. Sobra espacio, pero las acciones nunca quedan tapadas.
 *
 * @param keyboardHeight Alto del teclado visible, en dp (0 si está cerrado).
 * @param windowHeight Alto de la ventana, en dp, del mismo
 *   `useWindowDimensions` de `react-native-keyboard-controller`.
 * @param bottomEdge Coordenada Y, en la ventana, del borde inferior del
 *   contenedor; 0 o no finita si aún no se ha medido.
 * @returns dp a reservar en el pie del contenedor. Nunca negativo.
 */
export function reportKeyboardLift(
  keyboardHeight: number,
  windowHeight: number,
  bottomEdge: number
): number {
  if (!Number.isFinite(keyboardHeight) || keyboardHeight <= 0) return 0;
  if (!Number.isFinite(windowHeight) || windowHeight <= 0) return keyboardHeight;
  if (!Number.isFinite(bottomEdge) || bottomEdge <= 0) return keyboardHeight;

  const gapBelow = Math.max(windowHeight - bottomEdge, 0);
  return Math.max(keyboardHeight - gapBelow, 0);
}

/**
 * Mide el borde inferior del contenedor en la ventana y devuelve el relleno
 * inferior que lo mantiene sobre el teclado. Sin animación: es layout, así que
 * «reducir movimiento» no necesita tratamiento especial.
 */
export function useReportKeyboardLift() {
  const ref = useRef<View>(null);
  const [bottomEdge, setBottomEdge] = useState(0);
  const keyboardHeight = useKeyboardState((state) => (state.isVisible ? state.height : 0));
  const { height: windowHeight } = useWindowDimensions();

  const onLayout = useCallback(() => {
    ref.current?.measureInWindow?.((_x, y, _width, height) => {
      setBottomEdge(y + height);
    });
  }, []);

  return { ref, onLayout, lift: reportKeyboardLift(keyboardHeight, windowHeight, bottomEdge) };
}
