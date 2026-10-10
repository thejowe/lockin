/**
 * Pestañas: Descubrir / Matches / Perfil, en una píldora de cristal flotante.
 *
 * Sustituye a las tabs nativas (y a la barra superior que tenía la web) por una
 * sola barra para las tres plataformas, la de la dirección «cristal»: cristal
 * esmerilado sobre el contenido, la pestaña activa con su nombre y las demás
 * solo con icono.
 *
 * El resalte de la activa es una pieza aparte que se desliza con un muelle
 * hasta el botón elegido, y los botones cambian de ancho con una transición de
 * layout: el ojo sigue un solo objeto que se mueve, no dos que parpadean. Con
 * «reducir movimiento» el resalte salta sin recorrido.
 *
 * Las pestañas sin nombre visible llevan `accessibilityLabel` con el nombre: los
 * flujos de Maestro (`e2e/*.yaml`) las pulsan por «Matches» y «Perfil».
 */

import { BlurTargetView } from 'expo-blur';
import {
  TabList,
  Tabs,
  TabSlot,
  TabTrigger,
  type TabListProps,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { Pressable, StyleSheet, View, type LayoutRectangle } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Frosted } from '@/components/glass';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Duration, Radii, Spacing, Springs } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

/** Alto de cada botón de la barra (≥ 44 táctiles). */
const ITEM_HEIGHT = 46;
/** Separación de la píldora respecto al borde inferior, sobre el inset del sistema. */
const BAR_GAP = 12;

const TABS: {
  name: string;
  href: '/discover' | '/matches' | '/profile';
  label: string;
  icon: IconName;
}[] = [
  { name: 'discover', href: '/discover', label: 'Descubrir', icon: 'discover' },
  { name: 'matches', href: '/matches', label: 'Matches', icon: 'chat' },
  { name: 'profile', href: '/profile', label: 'Perfil', icon: 'person' },
];

/** Canal por el que el botón activo le dice al resalte dónde está. */
const IndicatorContext = createContext<(layout: LayoutRectangle) => void>(() => {});

export default function AppTabs() {
  // Solo Android lo usa: es el contenido que el esmerilado de la barra desenfoca.
  const blurTarget = useRef<View>(null);

  return (
    <Tabs style={styles.root}>
      <BlurTargetView ref={blurTarget} style={styles.root}>
        <TabSlot style={styles.root} />
      </BlurTargetView>
      <TabList asChild>
        <TabBar blurTarget={blurTarget}>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton icon={tab.icon}>{tab.label}</TabButton>
            </TabTrigger>
          ))}
        </TabBar>
      </TabList>
    </Tabs>
  );
}

function TabBar({
  blurTarget,
  children,
  style: _style,
  ...props
}: TabListProps & { blurTarget: RefObject<View | null>; children?: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const visible = useSharedValue(0);

  const indicator = useAnimatedStyle(() => ({
    opacity: visible.get(),
    width: width.get(),
    transform: [{ translateX: x.get() }],
  }));

  const report = useCallback(
    (layout: LayoutRectangle) => {
      // La primera medida coloca el resalte sin viajar desde el borde.
      const animate = visible.get() === 1 && !reduceMotion;
      x.set(animate ? withSpring(layout.x, Springs.glide) : layout.x);
      width.set(animate ? withSpring(layout.width, Springs.glide) : layout.width);
      visible.set(1);
    },
    [reduceMotion, visible, x, width]
  );

  return (
    <View
      {...props}
      pointerEvents="box-none"
      style={[styles.barWrap, { bottom: insets.bottom + BAR_GAP }]}>
      <Frosted blurTarget={blurTarget} style={styles.bar}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              backgroundColor: theme.backgroundSelected,
              boxShadow: `inset 0px 1px 0px ${theme.glassHighlight}`,
            },
            indicator,
          ]}
        />
        <IndicatorContext.Provider value={report}>{children}</IndicatorContext.Provider>
      </Frosted>
    </View>
  );
}

const TabButton = forwardRef<View, TabTriggerSlotProps & { icon: IconName }>(function TabButton(
  { children, isFocused, icon, ...props },
  ref
) {
  const theme = useTheme();
  const report = useContext(IndicatorContext);
  const reduceMotion = useReduceMotion();
  const layout = useRef<LayoutRectangle | null>(null);
  const label = typeof children === 'string' ? children : undefined;

  // Al cambiar de pestaña el botón ya está medido: avisa al resalte.
  useEffect(() => {
    if (isFocused && layout.current) report(layout.current);
  }, [isFocused, report]);

  return (
    <Animated.View
      // Con «reducir movimiento» no hay transición de layout: con las escalas de
      // animación del sistema a 0 Reanimated deja el botón congelado a medio
      // camino (barra con el ancho viejo, icono recortado, resalte en otra tab).
      // Sin transición, el botón salta a su medida final y `onLayout` la reporta.
      layout={
        reduceMotion
          ? undefined
          : LinearTransition.springify()
              .damping(Springs.glide.damping)
              .stiffness(Springs.glide.stiffness)
      }
      onLayout={(event) => {
        layout.current = event.nativeEvent.layout;
        if (isFocused) report(event.nativeEvent.layout);
      }}>
      <Pressable
        ref={ref}
        {...props}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: isFocused }}
        style={({ pressed }) => [
          styles.item,
          isFocused ? styles.itemFocused : styles.itemIdle,
          pressed && styles.pressed,
        ]}>
        <Icon name={icon} size={21} color={isFocused ? theme.text : theme.textSecondary} />
        {isFocused ? (
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(Duration.base)}
            exiting={reduceMotion ? undefined : FadeOut.duration(Duration.fast)}>
            <ThemedText type="smallBold">{children}</ThemedText>
          </Animated.View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  barWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    padding: 5,
  },
  indicator: {
    position: 'absolute',
    top: 5,
    left: 0,
    height: ITEM_HEIGHT,
    borderRadius: Radii.pill,
  },
  item: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: Radii.pill,
  },
  itemFocused: {
    paddingHorizontal: 18,
  },
  itemIdle: {
    width: 56,
  },
  pressed: {
    opacity: 0.7,
  },
});
