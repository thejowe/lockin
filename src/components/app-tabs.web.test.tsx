/**
 * Tests de la barra de tabs web.
 *
 * `arquitecto` eximió `app-tabs.tsx` de tener tests —es JSX declarativo sin una
 * sola rama— pero no su equivalente web, y con razón: `TabButton` sí decide
 * cosas. Ramifica dos veces sobre `isFocused` (el fondo de la pastilla y el
 * color del label) y lleva un `hitSlop` que es una decisión de accesibilidad
 * deliberada: la pastilla mide 28 px de alto y el hitSlop la lleva al objetivo
 * táctil mínimo de 44. Eso es justo lo que una regresión silenciosa se lleva por
 * delante sin que nada más lo note.
 *
 * Trampa de resolución: bajo el preset `jest-expo` ganan las extensiones
 * nativas, así que hay que importar `@/components/app-tabs.web` explícitamente.
 * `@/components/app-tabs` a secas resuelve al `.tsx`.
 */

import { render, screen } from '@testing-library/react-native';
// `jest.mock` se iza por encima de los imports, así que su fábrica solo puede
// usar variables cuyo nombre empiece por `mock`. De ahí los alias.
import { cloneElement as mockCloneElement, type ReactElement, type ReactNode } from 'react';
import { View as MockView } from 'react-native';

import AppTabs from '@/components/app-tabs.web';
import { Colors } from '@/constants/theme';

/** Qué tab dice `expo-router` que está activa. Se mueve test a test. */
const mockFocused = { name: 'discover' };

jest.mock('expo-router/ui', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <MockView>{children}</MockView>,
  TabSlot: () => null,
  // `asChild`: ambos renderizan directamente su hijo.
  TabList: ({ children }: { children: ReactElement }) => children,
  TabTrigger: ({ name, children }: { name: string; children: ReactElement }) =>
    mockCloneElement(children, { isFocused: name === mockFocused.name } as Partial<unknown>),
}));

jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: jest.fn(() => 'light') }));

const light = Colors.light;

/** La pastilla: el `View` que envuelve al label y lleva el fondo. */
function pill(label: string) {
  return screen.getByText(label).parent;
}

beforeEach(() => {
  mockFocused.name = 'discover';
});

describe('AppTabs (web)', () => {
  it('pinta las tres tabs de la app', async () => {
    await render(<AppTabs />);

    expect(screen.getByText('Descubrir')).toBeVisible();
    expect(screen.getByText('Matches')).toBeVisible();
    expect(screen.getByText('Perfil')).toBeVisible();
    expect(screen.getByText('LockIn')).toBeVisible();
  });

  it('resalta la tab activa con el fondo seleccionado y el label en latón', async () => {
    await render(<AppTabs />);

    expect(pill('Descubrir')).toHaveStyle({ backgroundColor: light.backgroundSelected });
    expect(screen.getByText('Descubrir')).toHaveStyle({ color: light.brass });
  });

  it('deja las inactivas sin fondo y con la tinta secundaria', async () => {
    await render(<AppTabs />);

    for (const label of ['Matches', 'Perfil']) {
      expect(pill(label)).toHaveStyle({ backgroundColor: 'transparent' });
      expect(screen.getByText(label)).toHaveStyle({ color: light.textSecondary });
    }
  });

  it('mueve el resalte cuando cambia la tab activa', async () => {
    mockFocused.name = 'profile';
    await render(<AppTabs />);

    expect(pill('Perfil')).toHaveStyle({ backgroundColor: light.backgroundSelected });
    expect(screen.getByText('Perfil')).toHaveStyle({ color: light.brass });
    expect(pill('Descubrir')).toHaveStyle({ backgroundColor: 'transparent' });
    expect(screen.getByText('Descubrir')).toHaveStyle({ color: light.textSecondary });
  });

  it('da a cada tab el hitSlop que la lleva al objetivo táctil de 44 px', async () => {
    await render(<AppTabs />);

    // La pastilla mide 28 px de alto: 8 px arriba y abajo son los 44 mínimos.
    // Sin esto la barra cumpliría el diseño y no la accesibilidad.
    for (const label of ['Descubrir', 'Matches', 'Perfil']) {
      const pressable = pill(label)?.parent;
      expect(pressable).toHaveProp('hitSlop', { top: 8, bottom: 8 });
    }
  });

  it('sigue la paleta oscura cuando el sistema está en oscuro', async () => {
    jest.requireMock('@/hooks/use-color-scheme').useColorScheme.mockReturnValue('dark');
    await render(<AppTabs />);

    expect(pill('Descubrir')).toHaveStyle({ backgroundColor: Colors.dark.backgroundSelected });
    expect(screen.getByText('Descubrir')).toHaveStyle({ color: Colors.dark.brass });
  });
});
