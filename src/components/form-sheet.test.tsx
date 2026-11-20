import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  Alert,
  PanResponder,
  Text,
  TextInput,
  type PanResponderGestureState,
  type GestureResponderEvent,
} from 'react-native';
import { useState } from 'react';

import { FormSheet } from './form-sheet';
import { requestClose } from './close-button';

function Editor({ close }: { close: () => void }) {
  const [name, setName] = useState('');
  return (
    <FormSheet
      testID="example-sheet"
      header={<Text>Proyecto</Text>}
      onClose={() => requestClose(!!name, close)}
      footer={<Text>Guardar</Text>}>
      <TextInput accessibilityLabel="Nombre" value={name} onChangeText={setName} />
    </FormSheet>
  );
}

afterEach(() => jest.restoreAllMocks());

it('la X, el arrastre y Atrás pasan por la confirmación y conservan el texto al cancelar', async () => {
  const pan = jest.spyOn(PanResponder, 'create');
  const alert = jest.spyOn(Alert, 'alert');
  const close = jest.fn();
  await render(<Editor close={close} />);
  await fireEvent.changeText(screen.getByLabelText('Nombre'), 'Atlas');
  await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
  expect(alert).toHaveBeenCalledTimes(1);
  const touch = {} as GestureResponderEvent;
  const swipe = { dx: 1, dy: 80, vy: 0.2 } as PanResponderGestureState;
  const handler = pan.mock.lastCall![0];
  expect(handler.onMoveShouldSetPanResponderCapture?.(touch, swipe)).toBe(true);
  expect(handler.onMoveShouldSetPanResponderCapture?.(touch, { ...swipe, dx: 120 })).toBe(false);
  await act(() => handler.onPanResponderRelease?.(touch, swipe));
  await fireEvent(screen.getByTestId('example-sheet'), 'requestClose');
  expect(alert).toHaveBeenCalledTimes(3);
  expect(screen.getByLabelText('Nombre').props.value).toBe('Atlas');
  expect(close).not.toHaveBeenCalled();
  await act(() =>
    alert.mock.lastCall?.[2]?.find((choice) => choice.style === 'destructive')?.onPress?.()
  );
  expect(close).toHaveBeenCalledTimes(1);
});
