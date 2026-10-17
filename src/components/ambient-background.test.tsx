/**
 * Lienzo de pantalla: negro liso, sin la luz ambiental de antes del 2026-10-17.
 */

import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AmbientBackground, Screen } from '@/components/ambient-background';
import { Colors } from '@/constants/theme';

describe('AmbientBackground', () => {
  it('ya no pinta ninguna luz de color', async () => {
    await render(<AmbientBackground variant="teal" />);

    expect(screen.toJSON()).toBeNull();
  });
});

describe('Screen', () => {
  it('pinta el fondo negro y el contenido encima, sin imagen detrás', async () => {
    await render(
      <Screen testID="screen" ambient="plum">
        <Text>Contenido</Text>
      </Screen>
    );

    expect(Colors.dark.background).toBe('#000000');
    expect(screen.getByTestId('screen')).toHaveStyle({ backgroundColor: '#000000' });
    expect(screen.queryByTestId('ambient-background', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByText('Contenido')).toBeTruthy();
  });
});
