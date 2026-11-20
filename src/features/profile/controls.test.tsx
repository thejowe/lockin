/**
 * Primitivas de formulario: lo que se ve cambia con el estado, y quien las usa
 * sigue recibiendo sus propios eventos.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { Colors } from '@/constants/theme';

import { OptionCard, Slider, TextField } from './controls';
import { PanResponder } from 'react-native';

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

it('el ojo de la contraseña revela el texto y permite volver a ocultarlo', async () => {
  await render(
    <TextField secureTextEntry accessibilityLabel="Clave" value="abcdef" onChangeText={jest.fn()} />
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Mostrar contraseña' }));
  expect(screen.getByLabelText('Clave').props.secureTextEntry).toBe(false);
  await fireEvent.press(screen.getByRole('button', { name: 'Ocultar contraseña' }));
  expect(screen.getByLabelText('Clave').props.secureTextEntry).toBe(true);
});

it('la barra usa el ancho medido para ajustar toque y arrastre al paso y los límites', async () => {
  const create = jest.spyOn(PanResponder, 'create');
  const onChange = jest.fn();
  try {
    await render(
      <Slider min={0} max={20} step={2} value={10} onChange={onChange} accessibilityLabel="Horas" />
    );
    const gesture = create.mock.calls.at(-1)![0];
    const touch = { nativeEvent: { locationX: 70 } } as Parameters<
      NonNullable<typeof gesture.onPanResponderGrant>
    >[0];
    const drag = { dx: 0 } as Parameters<NonNullable<typeof gesture.onPanResponderMove>>[1];
    expect(gesture.onStartShouldSetPanResponder!(touch, drag)).toBe(true);
    expect(gesture.onMoveShouldSetPanResponder!(touch, drag)).toBe(true);
    expect(gesture.onPanResponderTerminationRequest!(touch, drag)).toBe(false);
    gesture.onPanResponderGrant!(touch, drag);
    gesture.onPanResponderMove!(touch, drag);
    expect(onChange).not.toHaveBeenCalled();
    const slider = screen.getByRole('adjustable');
    await fireEvent(slider, 'layout', { nativeEvent: { layout: { width: 100 } } });
    gesture.onPanResponderGrant!(touch, drag);
    expect(onChange).toHaveBeenLastCalledWith(14);
    gesture.onPanResponderMove!(touch, { ...drag, dx: 100 });
    expect(onChange).toHaveBeenLastCalledWith(20);
    gesture.onPanResponderMove!(touch, { ...drag, dx: -100 });
    expect(onChange).toHaveBeenLastCalledWith(0);
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenLastCalledWith(8);
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenLastCalledWith(12);
  } finally {
    create.mockRestore();
  }
});
