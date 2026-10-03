/**
 * Tests de la barra de pestañas flotante.
 *
 * Lo que decide de verdad: que las tres pestañas se anuncien con su nombre
 * aunque solo la activa lo enseñe (Maestro pulsa «Matches» y «Perfil» por su
 * etiqueta), que el estado seleccionado lo lleve la activa y solo ella, y que
 * la activa sea la única con el nombre a la vista.
 */

import { render, screen } from '@testing-library/react-native';
// `jest.mock` se iza por encima de los imports: su fábrica solo puede usar
// variables cuyo nombre empiece por `mock`. De ahí los alias.
import { cloneElement as mockCloneElement, type ReactElement, type ReactNode } from 'react';
import { View as MockView } from 'react-native';

import AppTabs from '@/components/app-tabs';

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
});

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
});
