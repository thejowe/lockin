/**
 * Paginador entre pestañas: deslizar a izquierda o derecha en cualquier punto
 * de la pantalla lleva a la pestaña de al lado, y mientras el dedo arrastra se
 * ve entrar la otra sección (Instagram, TikTok).
 *
 * Las tres pantallas están montadas a la vez, una al lado de otra; lo único que
 * se mueve es un número (`position`, el índice en coma flotante) del que cuelga
 * el desplazamiento de cada página. El dedo lo escribe al arrastrar; al soltar,
 * o al pulsar un botón de la barra, un muelle lo lleva al índice de destino.
 *
 * Descubrir cede el gesto al deck mientras haya tarjetas (el swipe horizontal
 * ahí es el de la tarjeta). Cuando el deck está vacío, cargando o en error la
 * pantalla avisa con `useLockTabSwipe(false)` y el paginador vuelve a ser suyo.
 * El gesto cede ante el scroll vertical (`failOffsetY`) y solo arranca con un
 * arrastre horizontal claro (`activeOffsetX`).
 */

import { usePathname, useRouter } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { Springs } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

const ORDER = ['discover', 'matches', 'profile'] as const;

/** Fracción del ancho (o velocidad, px/s) que da el deslizamiento por válido. */
const MIN_FRACTION = 0.25;
const MIN_VELOCITY = 600;

/** Índice de la pestaña a la que corresponde una ruta, o `null` si no es una pestaña. */
export function tabIndex(pathname: string): number | null {
  const index = ORDER.findIndex((name) => pathname === `/${name}` || pathname.endsWith(`/${name}`));
  return index === -1 ? null : index;
}

/**
 * Índice de una ruta por su nombre (`discover`, `(tabs)/matches`…). El orden de
 * rutas del navegador no es el de la barra, así que la página se coloca por
 * nombre y nunca por la posición que le da `TabSlot`.
 */
export function routeIndex(routeName: string): number {
  const index = ORDER.findIndex((name) => routeName === name || routeName.endsWith(`/${name}`));
  return index === -1 ? 0 : index;
}

/**
 * Pestaña (índice) en la que acaba un arrastre que empezó en `start`.
 * Izquierda (`translationX < 0`) avanza; derecha retrocede. Sin distancia ni
 * velocidad suficientes, vuelve a `start`. Nunca sale de [0, últimaPestaña].
 */
export function settleIndex(
  start: number,
  translationX: number,
  velocityX: number,
  width: number
): number {
  'worklet';
  const far = Math.abs(translationX) > width * MIN_FRACTION;
  const fast = Math.abs(velocityX) > MIN_VELOCITY;
  if (!far && !fast) return start;
  // Si la distancia y la velocidad discrepan (arrastró a la izquierda pero lo
  // soltó con un latigazo a la derecha), manda la velocidad: es la intención.
  const dir = fast ? Math.sign(velocityX) : Math.sign(translationX);
  const next = start + (dir < 0 ? 1 : -1);
  return Math.min(ORDER.length - 1, Math.max(0, next));
}

type PagerContextValue = {
  position: SharedValue<number>;
  width: SharedValue<number>;
  setLocked: (locked: boolean) => void;
};

const PagerContext = createContext<PagerContextValue | null>(null);

/**
 * La pantalla de Descubrir llama a esto con `true` mientras su deck tiene
 * tarjetas (el gesto horizontal es de la tarjeta) y con `false` cuando no.
 */
export function useLockTabSwipe(locked: boolean) {
  const pager = useContext(PagerContext);
  const setLocked = pager?.setLocked;
  useEffect(() => {
    setLocked?.(locked);
    return () => setLocked?.(false);
  }, [locked, setLocked]);
}

export function SwipeBetweenTabs({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const reduceMotion = useReduceMotion();
  const window = useWindowDimensions();

  const focused = tabIndex(pathname) ?? 0;
  const position = useSharedValue(focused);
  const width = useSharedValue(window.width);
  const start = useSharedValue(focused);
  const [deckLocked, setDeckLocked] = useState(false);

  // Cualquier cambio de pestaña (gesto o botón de la barra) acaba aquí.
  useEffect(() => {
    position.set(reduceMotion ? focused : withSpring(focused, Springs.glide));
  }, [focused, position, reduceMotion]);

  const go = useCallback(
    (index: number) => {
      if (index !== focused) router.navigate(`/${ORDER[index]}`);
    },
    [focused, router]
  );

  // En Descubrir con tarjetas el deck es dueño del gesto horizontal.
  const enabled = !(focused === 0 && deckLocked);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .activeOffsetX([-16, 16])
        .failOffsetY([-16, 16])
        .onBegin(() => {
          start.set(focused);
        })
        .onUpdate((event) => {
          const w = width.get() || 1;
          const next = start.get() - event.translationX / w;
          // Sin hueco más allá de las pestañas de los extremos.
          position.set(Math.min(ORDER.length - 1, Math.max(0, next)));
        })
        .onEnd((event) => {
          const w = width.get() || 1;
          const target = settleIndex(start.get(), event.translationX, event.velocityX, w);
          // El muelle arranca con la velocidad del dedo (en índices por segundo).
          position.set(
            reduceMotion
              ? target
              : withSpring(target, { ...Springs.glide, velocity: -event.velocityX / w })
          );
          runOnJS(go)(target);
        }),
    [enabled, focused, go, position, reduceMotion, start, width]
  );

  const value = useMemo<PagerContextValue>(
    () => ({ position, width, setLocked: setDeckLocked }),
    [position, width]
  );

  return (
    <PagerContext.Provider value={value}>
      <GestureDetector gesture={gesture}>
        <View style={styles.fill} onLayout={(event) => width.set(event.nativeEvent.layout.width)}>
          {children}
        </View>
      </GestureDetector>
    </PagerContext.Provider>
  );
}

/**
 * Página del paginador: colocada a `index` anchos de la posición actual. Va en
 * el `renderFn` del `TabSlot`. Fuera de pantalla no recibe toques ni la lee el
 * lector de pantalla (y Maestro no la confunde con la visible).
 */
export function PagerPage({
  index,
  isFocused,
  children,
}: {
  index: number;
  isFocused: boolean;
  children: ReactNode;
}) {
  const pager = useContext(PagerContext);
  const style = useAnimatedStyle(() => {
    if (!pager) return {};
    return { transform: [{ translateX: (index - pager.position.get()) * pager.width.get() }] };
  });

  return (
    <Animated.View
      style={[styles.page, style]}
      pointerEvents={isFocused ? 'auto' : 'none'}
      accessibilityElementsHidden={!isFocused}
      importantForAccessibility={isFocused ? 'auto' : 'no-hide-descendants'}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
  page: StyleSheet.absoluteFill,
});
