/**
 * Aparición progresiva de arriba abajo para las pantallas de acceso.
 *
 * Cada hijo directo (título, texto, cada campo, cada botón) entra con la misma
 * curva de siempre (`enterUp`) y `RevealStep` ms más tarde que el anterior, así
 * que el texto «se escribe» de arriba hacia abajo en vez de salir de golpe.
 *
 * Los fragmentos (`<>…</>`) y los `null` de los condicionales se aplanan: los
 * formularios agrupan sus campos en fragmentos y no deben contar como un solo
 * bloque. Cambiar `revealKey` (p. ej. el paso del registro) remonta la pila y
 * repite la cascada: es «una pantalla nueva» aunque la ruta sea la misma.
 *
 * Reanimated apaga la entrada con «reducir movimiento»; ver `motion.ts`.
 */

import {
  Children,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type ReactPortal,
} from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { enterUp } from '@/components/motion';

/** Retraso entre un bloque y el siguiente, algo más lento que `Stagger` de las listas. */
const REVEAL_STEP_MS = 90;
/** Tope: un formulario largo no puede tardar segundos en terminar de pintarse. */
const REVEAL_MAX_INDEX = 12;

function flatten(node: ReactNode): ReactNode[] {
  const out: ReactNode[] = [];
  Children.forEach(node, (child) => {
    if (isValidElement(child) && child.type === Fragment) {
      out.push(...flatten((child as ReactElement<{ children?: ReactNode }>).props.children));
    } else if (child !== null && child !== undefined && typeof child !== 'boolean') {
      out.push(child as Exclude<ReactNode, ReactPortal>);
    }
  });
  return out;
}

export function RevealStack({
  children,
  revealKey,
  startIndex = 0,
  style,
}: {
  children: ReactNode;
  /** Al cambiar, la cascada empieza otra vez. */
  revealKey?: string;
  /** Posición inicial de la cascada, si algo ya ha entrado antes. */
  startIndex?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const items = flatten(children);

  return (
    <Animated.View key={revealKey} style={style}>
      {items.map((child, i) => (
        <Animated.View
          key={isValidElement(child) && child.key != null ? child.key : i}
          entering={enterUp(Math.min(startIndex + i, REVEAL_MAX_INDEX) * (REVEAL_STEP_MS / 40))}>
          {child}
        </Animated.View>
      ))}
    </Animated.View>
  );
}
