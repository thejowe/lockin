/**
 * Superficies de cristal: el estilo compartido y los dos envoltorios.
 */

import { render, screen } from '@testing-library/react-native';
import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Platform, Text } from 'react-native';

import { Frosted, Glass, glassStyle, hasNativeGlass } from '@/components/glass';
import { Colors, Radii } from '@/constants/theme';

jest.mock('expo-glass-effect', () => {
  const { View } = jest.requireActual('react-native');
  return {
    // Marca propia para distinguirlo del `View` del esmerilado.
    GlassView: (props: object) => <View {...props} accessibilityHint="liquid-glass" />,
    isLiquidGlassAvailable: jest.fn(() => false),
    isGlassEffectAPIAvailable: jest.fn(() => false),
  };
});

const theme = Colors.dark;
const realOS = Platform.OS;

function withNativeGlass(os: typeof Platform.OS, compiled: boolean, onDevice: boolean) {
  Platform.OS = os;
  jest.mocked(isLiquidGlassAvailable).mockReturnValue(compiled);
  jest.mocked(isGlassEffectAPIAvailable).mockReturnValue(onDevice);
}

afterEach(() => {
  Platform.OS = realOS;
  jest.mocked(isLiquidGlassAvailable).mockReturnValue(false);
  jest.mocked(isGlassEffectAPIAvailable).mockReturnValue(false);
});

describe('glassStyle', () => {
  it('por defecto es cristal de tarjeta con su brillo de canto', () => {
    expect(glassStyle(theme)).toMatchObject({
      backgroundColor: theme.backgroundElement,
      borderColor: theme.border,
      borderRadius: Radii.card,
      boxShadow: `inset 0px 1px 0px ${theme.glassHighlight}`,
    });
  });

  it('elevado sube un nivel de vidrio; flotante añade sombra', () => {
    const style = glassStyle(theme, { elevated: true, floating: true, radius: Radii.pill });

    expect(style.backgroundColor).toBe(theme.backgroundSelected);
    expect(style.borderRadius).toBe(Radii.pill);
    expect(String(style.boxShadow)).toContain('0px 18px 40px');
  });
});

describe('Glass y Frosted', () => {
  it('Glass pinta a sus hijos sobre el cristal', async () => {
    await render(
      <Glass testID="glass" elevated>
        <Text>Dentro</Text>
      </Glass>
    );

    expect(screen.getByText('Dentro')).toBeTruthy();
    expect(screen.getByTestId('glass')).toHaveStyle({ backgroundColor: theme.backgroundSelected });
  });

  it('Frosted pinta a sus hijos encima del esmerilado', async () => {
    await render(
      <Frosted testID="frost" radius={Radii.large}>
        <Text>Barra</Text>
      </Frosted>
    );

    expect(screen.getByText('Barra')).toBeTruthy();
    expect(screen.getByTestId('frost')).toHaveStyle({ borderRadius: Radii.large });
  });
});

describe('Liquid Glass en iOS 26+', () => {
  it('solo con iOS, compilado con él y con el API en el dispositivo', () => {
    withNativeGlass('ios', true, true);
    expect(hasNativeGlass()).toBe(true);

    // Una beta de iOS 26 sin el API: GlassView se caería.
    withNativeGlass('ios', true, false);
    expect(hasNativeGlass()).toBe(false);

    withNativeGlass('ios', false, true);
    expect(hasNativeGlass()).toBe(false);

    withNativeGlass('android', true, true);
    expect(hasNativeGlass()).toBe(false);
  });

  it('Frosted lo pinta el sistema: sin grafito ni recorte que apaguen el cristal', async () => {
    withNativeGlass('ios', true, true);

    await render(
      <Frosted testID="frost" radius={Radii.large}>
        <Text>Barra</Text>
      </Frosted>
    );

    const frost = screen.getByTestId('frost');
    expect(screen.getByText('Barra')).toBeTruthy();
    expect(frost.props.accessibilityHint).toBe('liquid-glass');
    expect(frost).toHaveStyle({ borderRadius: Radii.large });
    expect(frost).not.toHaveStyle({ overflow: 'hidden' });
    expect(frost).not.toHaveStyle({ backgroundColor: '#141416B8' });
  });

  it('sin Liquid Glass, Frosted sigue con el esmerilado y su relleno de seguridad', async () => {
    withNativeGlass('ios', true, false);

    await render(<Frosted testID="frost" />);

    const frost = screen.getByTestId('frost');
    expect(frost.props.accessibilityHint).toBeUndefined();
    expect(frost).toHaveStyle({ backgroundColor: '#141416B8', overflow: 'hidden' });
  });
});
