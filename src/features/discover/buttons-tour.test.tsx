/**
 * Mini tutorial de botones: sale tras la mano de la tarjeta, avanza con cada
 * toque (Deshacer → Super Like → Boost → Filtros) y no vuelve.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { buttonsTourKey, TOUR_STEPS, useButtonsTour } from './buttons-tour';

import { Pressable, Text } from 'react-native';

function Harness({ ready = true, user = 'u1' }: { ready?: boolean; user?: string }) {
  const tour = useButtonsTour(ready, user);
  return (
    <Pressable accessibilityLabel="avanzar" onPress={tour.next}>
      <Text>{tour.step === null ? 'fuera' : TOUR_STEPS[tour.step].title}</Text>
    </Pressable>
  );
}

beforeEach(() => AsyncStorage.clear());

it('recorre los cuatro pasos y se recuerda', async () => {
  await render(<Harness />);

  expect(await screen.findByText('Deshacer')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('avanzar'));
  expect(await screen.findByText('Super Like')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('avanzar'));
  expect(await screen.findByText('Boost')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('avanzar'));
  expect(await screen.findByText('Filtros')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('avanzar'));

  await waitFor(() => expect(screen.getByText('fuera')).toBeTruthy());
  await waitFor(async () => expect(await AsyncStorage.getItem(buttonsTourKey('u1'))).toBe('1'));
});

it('no sale mientras la mano de la tarjeta sigue en juego', async () => {
  await render(<Harness ready={false} />);
  expect(screen.getByText('fuera')).toBeTruthy();
});

it('una cuenta nueva en el mismo teléfono lo vuelve a ver', async () => {
  await AsyncStorage.setItem(buttonsTourKey('u1'), '1');

  const old = await render(<Harness user="u1" />);
  await waitFor(async () => expect(await AsyncStorage.getItem(buttonsTourKey('u1'))).toBe('1'));
  expect(screen.getByText('fuera')).toBeTruthy();
  await old.unmount();

  await render(<Harness user="u2" />);
  expect(await screen.findByText('Deshacer')).toBeTruthy();
});
