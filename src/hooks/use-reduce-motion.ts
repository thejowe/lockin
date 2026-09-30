/**
 * El ajuste de accesibilidad «reducir movimiento» del sistema.
 *
 * Quien lo activa pide que la interfaz no se mueva sola: el mareo, el vértigo y
 * las migrañas vestibulares son motivos habituales. No pide que la interfaz deje
 * de responder al dedo — arrastrar una tarjeta es manipulación directa, no
 * animación —, así que esto solo apaga los recorridos que la app se inventa.
 *
 * Lo consumen el deck, los botones con press state y la entrada del match: todo
 * lo que se mueve en la app pasa por aquí.
 *
 * Se consulta `AccessibilityInfo` de React Native y no `useReducedMotion()` de
 * Reanimated a propósito: el mock oficial de Reanimated que carga `jest.setup.js`
 * no incluye ese hook (`// useReducedMotion: ADD ME IF NEEDED` en su fuente), así
 * que sería una decisión de accesibilidad imposible de cubrir con un test.
 *
 * https://reactnative.dev/docs/accessibilityinfo
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** `true` si el sistema pide reducir movimiento. Se actualiza si cambia en caliente. */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    // La consulta inicial es asíncrona: hasta que responda se anima, que es el
    // comportamiento de siempre. Si el usuario lo tiene puesto, el primer swipe
    // ya llega con el valor bueno — la respuesta tarda mucho menos que él.
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
