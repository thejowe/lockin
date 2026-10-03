/**
 * El botón compartido: pulsa, se desactiva, y con `href` navega a través de
 * `Link` sin perder la forma (en web, `Link asChild` descartaba el estilo del
 * `Pressable` y el botón se quedaba sin fondo).
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { Colors } from '@/constants/theme';

let mockNavigate: jest.Mock;

jest.mock('expo-router', () => ({
  Link: ({
    children,
    href,
  }: {
    children: React.ReactElement<{ onPress: () => void }>;
    href: string;
  }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    return React.cloneElement(children, { onPress: () => mockNavigate(href) });
  },
}));

beforeEach(() => {
  mockNavigate = jest.fn();
});

/** La vista que pinta la píldora: el padre directo del texto. */
function shapeOf(label: string) {
  return StyleSheet.flatten(screen.getByText(label).parent?.props.style);
}

describe('Button', () => {
  it('llama a onPress al pulsar', async () => {
    const onPress = jest.fn();
    await render(<Button label="Guardar" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('el principal es latón sólido con tinta sobre acento', async () => {
    await render(<Button label="Guardar" onPress={() => {}} />);

    expect(shapeOf('Guardar')).toMatchObject({ backgroundColor: Colors.light.brass });
    expect(screen.getByText('Guardar')).toHaveStyle({ color: Colors.light.onAccent });
  });

  it('secundario y danger son cristal con canto, no relleno de acento', async () => {
    await render(
      <>
        <Button label="Otra" variant="secondary" onPress={() => {}} />
        <Button label="Descartar" variant="danger" onPress={() => {}} />
      </>
    );

    expect(shapeOf('Otra')).toMatchObject({
      borderColor: Colors.dark.border,
      backgroundColor: Colors.dark.backgroundElement,
    });
    expect(shapeOf('Descartar')).toMatchObject({
      borderColor: Colors.dark.danger,
      backgroundColor: Colors.dark.dangerSoft,
    });
    expect(screen.getByText('Descartar')).toHaveStyle({ color: Colors.dark.danger });
  });

  it('desactivado no responde y lo anuncia', async () => {
    const onPress = jest.fn();
    await render(<Button label="Guardar" onPress={onPress} disabled />);

    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('con href navega y conserva la forma de botón', async () => {
    await render(<Button label="Volver a Matches" href="/matches" />);

    await fireEvent.press(screen.getByRole('button', { name: 'Volver a Matches' }));
    expect(mockNavigate).toHaveBeenCalledWith('/matches');
    expect(shapeOf('Volver a Matches')).toMatchObject({ backgroundColor: Colors.light.brass });
  });

  it('la píldora no se aplana y lleva opacidad explícita también en reposo', async () => {
    // Si la opacidad solo existiera al pulsar, Fabric aplanaría la vista en
    // reposo y revienta al reubicar el texto (E2E de registro, run 36711286245).
    await render(<Button label="Guardar" onPress={() => {}} />);

    const shape = screen.getByText('Guardar').parent;
    expect(shape?.props.collapsable).toBe(false);
    expect(shapeOf('Guardar').opacity).toBe(1);
  });
});
