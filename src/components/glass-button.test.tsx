/**
 * Botón de cristal de la bienvenida.
 *
 * Lo que no puede volver: en iOS 26, con Liquid Glass, un `opacity` en el
 * `GlassView` (o en un padre) lo deja sin pintar hasta que algo lo repinta, y
 * «Iniciar sesión» no se veía hasta pulsarlo (2026-10-17). Aquí se fija que
 * la aparición la hace el propio cristal y que la opacidad del vidrio no se toca.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { act, render, screen } from '@testing-library/react-native';
import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Platform, StyleSheet } from 'react-native';

import { GlassButton } from '@/components/glass-button';

jest.mock('expo-glass-effect', () => {
  const { View } = jest.requireActual('react-native');
  return {
    GlassView: (props: object) => <View {...props} testID="liquid-glass" />,
    isLiquidGlassAvailable: jest.fn(() => false),
    isGlassEffectAPIAvailable: jest.fn(() => false),
  };
});

const realOS = Platform.OS;

function nativeGlass(on: boolean) {
  Platform.OS = on ? 'ios' : realOS;
  jest.mocked(isLiquidGlassAvailable).mockReturnValue(on);
  jest.mocked(isGlassEffectAPIAvailable).mockReturnValue(on);
}

afterEach(() => {
  nativeGlass(false);
  jest.useRealTimers();
});

describe('con Liquid Glass (iOS 26+)', () => {
  beforeEach(() => nativeGlass(true));

  it('el cristal nunca lleva opacidad, ni deshabilitado', async () => {
    await render(<GlassButton label="Iniciar sesión" tint="light" disabled onPress={jest.fn()} />);

    const glass = screen.getByTestId('liquid-glass');
    expect(StyleSheet.flatten(glass.props.style).opacity).toBeUndefined();
    expect(glass.props.glassEffectStyle).toMatchObject({ style: 'regular' });
  });

  it('con revealDelay se materializa él solo: de none a regular, animado', async () => {
    jest.useFakeTimers();
    await render(
      <GlassButton label="Iniciar sesión" tint="light" revealDelay={1000} onPress={jest.fn()} />
    );

    const before = screen.getByTestId('liquid-glass');
    expect(before.props.glassEffectStyle).toMatchObject({ style: 'none' });
    expect(screen.queryByText('Iniciar sesión')).toBeNull();
    // Accesible desde el principio: el lector de pantalla no espera a la animación.
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    const after = screen.getByTestId('liquid-glass');
    expect(after.props.glassEffectStyle).toMatchObject({ style: 'regular', animate: true });
    expect(StyleSheet.flatten(after.props.style).opacity).toBeUndefined();
    expect(screen.getByText('Iniciar sesión')).toBeTruthy();
  });
});

describe('sin Liquid Glass', () => {
  it('con revealDelay guarda el hueco y después pinta el esmerilado', async () => {
    jest.useFakeTimers();
    await render(
      <GlassButton label="Registrarse" tint="dark" revealDelay={500} onPress={jest.fn()} />
    );

    expect(screen.queryByText('Registrarse')).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByText('Registrarse')).toBeTruthy();
    expect(screen.queryByTestId('liquid-glass')).toBeNull();
  });
});
