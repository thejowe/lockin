import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, StyleSheet } from 'react-native';

import { CloseButton, requestClose } from './close-button';
import { setLocalePreference } from '@/i18n';

afterEach(async () => {
  await act(() => setLocalePreference('auto'));
  jest.restoreAllMocks();
});

it.each([
  ['es', 'Cerrar'],
  ['en', 'Close'],
  ['ca', 'Tanca'],
] as const)('muestra una X accesible de 44 puntos en %s', async (locale, label) => {
  await setLocalePreference(locale);
  const close = jest.fn();
  const { rerender } = await render(<CloseButton onPress={close} />);
  const button = screen.getByRole('button', { name: label });
  expect(StyleSheet.flatten(button.props.style)).toMatchObject({ width: 44, height: 44 });
  await fireEvent.press(button);
  await rerender(<CloseButton onPress={close} disabled />);
  expect(screen.getByRole('button', { name: label })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: label }));
  expect(close).toHaveBeenCalledTimes(1);
});

it('cierra directamente el formulario intacto y conserva el borrador hasta elegir Descartar', () => {
  const alert = jest.spyOn(Alert, 'alert');
  const close = jest.fn();
  requestClose(false, close);
  expect(alert).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledTimes(1);
  requestClose(true, close);
  expect(alert).toHaveBeenCalledWith('¿Descartar los cambios?', undefined, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Descartar', style: 'destructive', onPress: close },
  ]);
  expect(close).toHaveBeenCalledTimes(1);
  alert.mock.lastCall?.[2]?.[1].onPress?.();
  expect(close).toHaveBeenCalledTimes(2);
});
