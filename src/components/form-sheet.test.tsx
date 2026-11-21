import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Text, TextInput } from 'react-native';
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

async function dragHeader(dx: number, dy: number, elapsed: number) {
  const header = screen.getByTestId('sheet-drag-area');
  const touch = (pageX: number, pageY: number, timestamp: number) => ({
    nativeEvent: { pageX, pageY, timestamp },
  });
  expect(header.props.onStartShouldSetResponder()).toBe(true);
  await fireEvent(header, 'responderGrant', touch(125, 30, 100));
  // Android puede agrupar los movimientos entre el contacto y la liberación.
  await fireEvent(header, 'responderRelease', touch(125 + dx, 30 + dy, 100 + elapsed));
}

it('la X, el arrastre y Atrás pasan por la confirmación y conservan el texto al cancelar', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const close = jest.fn();
  await render(<Editor close={close} />);
  await fireEvent.changeText(screen.getByLabelText('Nombre'), 'Atlas');
  await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
  expect(alert).toHaveBeenCalledTimes(1);
  await dragHeader(1, 80, 420);
  await fireEvent(screen.getByTestId('example-sheet'), 'requestClose');
  expect(alert).toHaveBeenCalledTimes(3);
  expect(screen.getByLabelText('Nombre').props.value).toBe('Atlas');
  expect(close).not.toHaveBeenCalled();
  await act(() =>
    alert.mock.lastCall?.[2]?.find((choice) => choice.style === 'destructive')?.onPress?.()
  );
  expect(close).toHaveBeenCalledTimes(1);
});

it('un gesto corto se cancela y una operación en curso bloquea los cierres', async () => {
  const close = jest.fn();
  const sheet = (disabled: boolean) => (
    <FormSheet
      testID="busy-sheet"
      header={<Text>Proyecto</Text>}
      disabled={disabled}
      onClose={close}>
      <Text>Atlas</Text>
    </FormSheet>
  );
  const { rerender } = await render(sheet(false));
  await dragHeader(0, 18, 180);
  await dragHeader(120, 80, 300);
  await dragHeader(0, -80, 100);
  expect(close).not.toHaveBeenCalled();
  await dragHeader(0, 18, 20);
  expect(close).toHaveBeenCalledTimes(1);
  await rerender(sheet(true));
  expect(screen.getByTestId('sheet-drag-area').props.onStartShouldSetResponder()).toBe(false);
  await fireEvent(screen.getByTestId('busy-sheet'), 'requestClose');
  await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
  expect(close).toHaveBeenCalledTimes(1);
});
