/**
 * Cuánto separa la ventana del `KeyboardAvoidingView` del chat.
 *
 * `KeyboardAvoidingView` de `react-native-keyboard-controller` calcula su
 * relleno así (`components/KeyboardAvoidingView/index.tsx`):
 *
 *     padding = max(frame.y + frame.height - (windowHeight - teclado - offset), 0)
 *
 * `frame.height` sale de `onLayout` y es correcta. `frame.y` NO: `onLayout` da
 * coordenadas relativas al padre, así que vale 0 aunque la vista arranque por
 * debajo de la barra de estado y de la cabecera nativa. El relleno sale corto
 * justo por esa distancia y el compositor se queda debajo del teclado.
 *
 * `automaticOffset` existe para arreglarlo pidiendo la posición absoluta al
 * nativo (`viewPositionInWindow`), pero en este proyecto no llega a aplicarse:
 * el `.catch` del componente se traga el fallo en silencio y vuelve a la
 * posición relativa. Medido en emulador (ver `docs/plan/todo/chat.md`), con
 * `automaticOffset` puesto el relleno seguía siendo el de `frame.y = 0`.
 *
 * Así que el offset se calcula aquí, sin llamadas nativas. La vista llega hasta
 * el borde inferior de la ventana —es la premisa de `behavior="padding"`, y con
 * edge-to-edge se cumple—, luego lo que le falta por arriba es exactamente lo
 * que su altura le falta a la ventana. No hace falta saber cuánto miden la
 * barra de estado ni la cabecera: la resta ya los incluye.
 *
 * Ojo con el sentido de la resta y con no sumar esto a `automaticOffset`: si
 * ambos se aplican, la distancia se cuenta dos veces y el compositor sube de
 * más.
 *
 * @param windowHeight Alto de la ventana entera, en dp. Tiene que venir del
 *   mismo `useWindowDimensions` de `react-native-keyboard-controller` que usa
 *   el componente por dentro, no del de React Native.
 * @param avoidingViewHeight Alto del propio `KeyboardAvoidingView`, en dp, tal
 *   y como lo da su `onLayout`.
 * @returns La distancia en dp entre el borde superior de la ventana y el de la
 *   vista. Nunca negativa.
 */
export function keyboardVerticalOffset(windowHeight: number, avoidingViewHeight: number): number {
  // Antes del primer `onLayout` no hay altura que restar, y una ventana de alto
  // 0 solo pasa en mitad de una rotación: en ambos casos, ningún offset.
  if (windowHeight <= 0 || avoidingViewHeight <= 0) {
    return 0;
  }

  return Math.max(windowHeight - avoidingViewHeight, 0);
}
