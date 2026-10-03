/**
 * Primitivas de formulario: lo que se ve cambia con el estado, y quien las usa
 * sigue recibiendo sus propios eventos.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { Colors } from '@/constants/theme';

import { OptionCard, TextField } from './controls';

const theme = Colors.dark;

describe('TextField', () => {
  it('con el foco, el canto pasa a brasa; al salir, vuelve', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    await render(
      <TextField
        value=""
        onChangeText={() => {}}
        accessibilityLabel="Nombre"
        onFocus={onFocus}
        onBlur={onBlur}
      />
    );

    const input = screen.getByLabelText('Nombre');
    expect(input).toHaveStyle({ borderColor: theme.border });

    await fireEvent(input, 'focus');
    expect(screen.getByLabelText('Nombre')).toHaveStyle({ borderColor: theme.brass });
    expect(onFocus).toHaveBeenCalledTimes(1);

    await fireEvent(screen.getByLabelText('Nombre'), 'blur');
    expect(screen.getByLabelText('Nombre')).toHaveStyle({ borderColor: theme.border });
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});

describe('OptionCard', () => {
  it('la elegida lleva canto de brasa y se anuncia seleccionada', async () => {
    await render(
      <OptionCard
        option={{ value: 'par', label: 'Cofundador', description: 'Alguien en igualdad' }}
        selected
        icon="pair"
        onPress={() => {}}
      />
    );

    const card = screen.getByRole('radio', { name: 'Cofundador' });
    expect(card).toBeSelected();
    expect(card).toHaveStyle({ borderColor: theme.brass });
  });
});
