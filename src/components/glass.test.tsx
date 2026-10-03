/**
 * Superficies de cristal: el estilo compartido y los dos envoltorios.
 */

import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Frosted, Glass, glassStyle } from '@/components/glass';
import { Colors, Radii } from '@/constants/theme';

const theme = Colors.dark;

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
