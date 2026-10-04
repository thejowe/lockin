/**
 * Luz ambiental: tiene que llenar la pantalla entera, sea del tamaño que sea.
 */

import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { AmbientBackground, Screen } from '@/components/ambient-background';
import { Colors } from '@/constants/theme';

describe('AmbientBackground', () => {
  it('la imagen ocupa el 100 % de un contenedor a pantalla completa, no su tamaño propio', async () => {
    await render(<AmbientBackground variant="teal" />);

    // Decorativa: oculta a la accesibilidad, así que hay que pedirla aparte.
    const image = screen.getByTestId('ambient-background', { includeHiddenElements: true });
    // Solo `absoluteFill` en la imagen dejaba franjas negras en Android.
    expect(image).toHaveStyle({ width: '100%', height: '100%' });
    expect(image.parent).toHaveStyle(StyleSheet.absoluteFill);
  });
});

describe('Screen', () => {
  it('pinta el fondo grafito, la luz y el contenido encima', async () => {
    await render(
      <Screen testID="screen" ambient="plum">
        <Text>Contenido</Text>
      </Screen>
    );

    expect(screen.getByTestId('screen')).toHaveStyle({ backgroundColor: Colors.dark.background });
    expect(screen.getByTestId('ambient-background', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Contenido')).toBeTruthy();
  });
});
