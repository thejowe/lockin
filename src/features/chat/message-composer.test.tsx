/**
 * Tests del compositor de mensajes.
 *
 * Toda su lógica es `canSend`: decide si el botón está vivo y, con él, si un
 * mensaje vacío o un doble toque pueden colarse hasta el repositorio. Eso es lo
 * que se prueba aquí, junto con el `ref` que la pantalla necesita para devolver
 * el foco después de elegir un icebreaker.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { createRef } from 'react';
import { TextInput } from 'react-native';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { MessageComposer } from './message-composer';

/** Las props obligatorias, con espías por defecto. */
function setup(overrides: Partial<React.ComponentProps<typeof MessageComposer>> = {}) {
  const props = {
    value: '',
    onChangeText: jest.fn(),
    onSend: jest.fn(),
    ...overrides,
  };
  return { props, ui: <MessageComposer {...props} /> };
}

describe('MessageComposer', () => {
  it('anuncia el campo y el botón con nombre accesible', async () => {
    const { ui } = setup();
    await render(ui);

    expect(screen.getByLabelText('Mensaje')).toBeTruthy();
    expect(screen.getByLabelText('Enviar mensaje')).toBeTruthy();
  });

  it('usa un placeholder por defecto y admite otro', async () => {
    const { ui } = setup();
    await render(ui);
    expect(screen.getByPlaceholderText('Escribe un mensaje')).toBeTruthy();

    const custom = setup({ placeholder: 'Rompe el hielo' });
    await render(custom.ui);
    expect(screen.getByPlaceholderText('Rompe el hielo')).toBeTruthy();
  });

  it('pinta el texto que le pasan: es controlado', async () => {
    const { ui } = setup({ value: 'Hola' });
    await render(ui);

    expect(screen.getByLabelText('Mensaje').props.value).toBe('Hola');
  });

  it('propaga cada cambio de texto hacia arriba', async () => {
    const { props, ui } = setup();
    await render(ui);

    await fireEvent.changeText(screen.getByLabelText('Mensaje'), 'Hola');

    expect(props.onChangeText).toHaveBeenCalledWith('Hola');
  });

  it('con texto, enviar está disponible y avisa', async () => {
    const { props, ui } = setup({ value: 'Hola' });
    await render(ui);

    const send = screen.getByLabelText('Enviar mensaje');
    expect(send).toBeEnabled();

    await fireEvent.press(send);
    expect(props.onSend).toHaveBeenCalledTimes(1);
  });

  it('sin texto no se puede enviar', async () => {
    const { props, ui } = setup({ value: '' });
    await render(ui);

    const send = screen.getByLabelText('Enviar mensaje');
    expect(send).toBeDisabled();

    await fireEvent.press(send);
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it('solo espacios cuenta como vacío', async () => {
    const { props, ui } = setup({ value: '   \n  ' });
    await render(ui);

    expect(screen.getByLabelText('Enviar mensaje')).toBeDisabled();

    await fireEvent.press(screen.getByLabelText('Enviar mensaje'));
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it('mientras el envío anterior está en vuelo no se puede reenviar', async () => {
    const { props, ui } = setup({ value: 'Hola', sending: true });
    await render(ui);

    expect(screen.getByLabelText('Enviar mensaje')).toBeDisabled();

    await fireEvent.press(screen.getByLabelText('Enviar mensaje'));
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it('expone el TextInput por ref para que la pantalla devuelva el foco', async () => {
    const ref = createRef<TextInput>();
    await render(
      <MessageComposer ref={ref} value="" onChangeText={jest.fn()} onSend={jest.fn()} />
    );

    expect(ref.current).not.toBeNull();
  });
});
