/**
 * Tests de la barra de pestañas flotante.
 *
 * Lo que decide de verdad: que las tres pestañas se anuncien con su nombre
 * aunque solo la activa lo enseñe (Maestro pulsa «Matches» y «Perfil» por su
 * etiqueta), que el estado seleccionado lo lleve la activa y solo ella, y que
 * la activa sea la única con el nombre a la vista.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
// `jest.mock` se iza por encima de los imports: su fábrica solo puede usar
// variables cuyo nombre empiece por `mock`. De ahí los alias.
import { cloneElement as mockCloneElement, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, View as MockView, type StyleProp, type ViewStyle } from 'react-native';

import AppTabs from '@/components/app-tabs';

/** Lo que dice «reducir movimiento» del sistema. Se mueve test a test. */
const mockSystem = { reduceMotion: false };

// El mock oficial crea un valor compartido nuevo en cada render; con ese, el
// resalte volvería a 0 al repintar y el test no vería dónde terminó. Este lo
// conserva entre renders, como el real.
jest.mock('react-native-reanimated', () => {
  const { useRef } = jest.requireActual<typeof import('react')>('react');
  const mock = jest.requireActual('react-native-reanimated/mock');
  return {
    ...mock,
    __esModule: true,
    useSharedValue: <T,>(init: T) => {
      const ref = useRef<{ value: T; get: () => T; set: (v: T) => void } | null>(null);
      if (!ref.current) {
        const box = {
          value: init,
          get: () => box.value,
          set: (v: T) => {
            box.value = v;
          },
        };
        ref.current = box;
      }
      return ref.current;
    },
  };
});

jest.mock('@/hooks/use-reduce-motion', () => ({
  useReduceMotion: () => mockSystem.reduceMotion,
}));

/** Qué pestaña dice `expo-router` que está activa. Se mueve test a test. */
const mockFocused = { name: 'discover' };

jest.mock('expo-router/ui', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <MockView>{children}</MockView>,
  TabSlot: () => null,
  // `asChild`: los dos pintan directamente a su hijo.
  TabList: ({ children }: { children: ReactElement }) => children,
  TabTrigger: ({ name, children }: { name: string; children: ReactElement }) =>
    mockCloneElement(children, { isFocused: name === mockFocused.name } as Partial<unknown>),
}));

beforeEach(() => {
  mockFocused.name = 'discover';
  mockSystem.reduceMotion = false;
});

/** El resalte es la única vista con `pointerEvents="none"` de la barra. */
function findIndicator(node: unknown): { props: { style: unknown } } | undefined {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findIndicator(child);
      if (found) return found;
    }
    return undefined;
  }
  const el = node as { props?: Record<string, unknown>; children?: unknown };
  if (el.props?.pointerEvents === 'none') return el as { props: { style: unknown } };
  return findIndicator(el.children);
}

describe('AppTabs', () => {
  it('anuncia las tres pestañas por su nombre', async () => {
    await render(<AppTabs />);

    for (const label of ['Descubrir', 'Matches', 'Perfil']) {
      expect(screen.getByRole('tab', { name: label })).toBeTruthy();
    }
  });

  it('solo la activa está seleccionada y enseña su nombre', async () => {
    mockFocused.name = 'matches';
    await render(<AppTabs />);

    expect(screen.getByRole('tab', { name: 'Matches' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Descubrir' })).not.toBeSelected();
    expect(screen.getByRole('tab', { name: 'Perfil' })).not.toBeSelected();

    expect(screen.getByText('Matches')).toBeTruthy();
    expect(screen.queryByText('Descubrir')).toBeNull();
    expect(screen.queryByText('Perfil')).toBeNull();
  });

  it('las pestañas sin nombre visible siguen midiendo 44 táctiles', async () => {
    await render(<AppTabs />);

    for (const label of ['Matches', 'Perfil']) {
      expect(screen.getByRole('tab', { name: label })).toHaveStyle({ height: 46, width: 56 });
    }
  });

  describe('con «reducir movimiento»', () => {
    // Bug medido en Android con las escalas de animación a 0: la transición de
    // layout dejaba los botones congelados a medio camino (barra con el ancho
    // viejo, icono de Perfil recortado y el resalte sobre Matches).
    it('los botones no llevan transición de layout ni entrada del nombre', async () => {
      mockSystem.reduceMotion = true;
      mockFocused.name = 'profile';
      await render(<AppTabs />);

      const wrapper = screen.getByRole('tab', { name: 'Perfil' }).parent;
      expect(wrapper?.props.layout).toBeUndefined();
      const name = screen.getByText('Perfil').parent;
      expect(name?.props.entering).toBeUndefined();
      expect(name?.props.exiting).toBeUndefined();
    });

    it('con movimiento normal sí hay transición de layout', async () => {
      await render(<AppTabs />);

      const wrapper = screen.getByRole('tab', { name: 'Matches' }).parent;
      expect(wrapper?.props.layout).toBeDefined();
    });

    it('el resalte salta a la pestaña activa, con su ancho, sin recortar el icono', async () => {
      mockSystem.reduceMotion = true;
      mockFocused.name = 'profile';
      await render(<AppTabs />);

      const wrapper = screen.getByRole('tab', { name: 'Perfil' }).parent;
      await fireEvent(wrapper!, 'layout', {
        nativeEvent: { layout: { x: 130, y: 5, width: 112, height: 46 } },
      });

      // El mock de Reanimated evalúa el estilo animado al renderizar, no al
      // cambiar el valor compartido: un nuevo render lee el valor ya asignado.
      await screen.rerender(<AppTabs />);
      const indicator = findIndicator(screen.toJSON());
      const style = StyleSheet.flatten(indicator?.props.style as StyleProp<ViewStyle>) as ViewStyle;
      expect(style.width).toBe(112);
      expect(style.opacity).toBe(1);
      expect(style.transform).toEqual([{ translateX: 130 }]);
      // El botón activo ocupa icono + nombre: nunca el ancho de solo icono.
      expect(screen.getByRole('tab', { name: 'Perfil' })).not.toHaveStyle({ width: 56 });
    });
  });
});
