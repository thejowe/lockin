/**
 * Mini tutorial de botones: sale tras la mano de la tarjeta, avanza con cada
 * toque (Deshacer → Super Like → Boost → Filtros) y no vuelve.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import {
  buttonsTourKey,
  FiltersSpotlight,
  FILTERS_STEP,
  TOUR_STEPS,
  TourSpotlight,
  useButtonsTour,
} from './buttons-tour';

import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

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

describe('TourSpotlight', () => {
  const target = { x: 100, y: 20, width: 56, height: 56 };

  it.each(TOUR_STEPS.slice(0, FILTERS_STEP).map((step, index) => [index, step.title] as const))(
    'paso %i: explica «%s» y dice cuánto queda',
    async (index, title) => {
      await render(
        <TourSpotlight step={index} target={target} rowX={0} rowHeight={80} windowWidth={390} />
      );

      expect(screen.getByTestId('buttons-tour')).toBeTruthy();
      expect(screen.getByText(title)).toBeTruthy();
      expect(
        screen.getByText(new RegExp(`${index + 1}/${TOUR_STEPS.length} · Toca para seguir`))
      ).toBeTruthy();
    }
  );

  it('el último paso invita a empezar', async () => {
    await render(
      <TourSpotlight
        step={TOUR_STEPS.length - 1}
        target={target}
        rowX={0}
        rowHeight={80}
        windowWidth={390}
      />
    );

    expect(screen.getByText(/Toca para empezar/)).toBeTruthy();
  });

  it('un botón pegado al borde no saca la burbuja de la pantalla', async () => {
    await render(
      <TourSpotlight
        step={0}
        target={{ x: 0, y: 0, width: 56, height: 56 }}
        rowX={10}
        rowHeight={80}
        windowWidth={390}
      />
    );

    expect(screen.getByText(TOUR_STEPS[0].title)).toBeTruthy();
  });
});

describe('FiltersSpotlight', () => {
  /** Jest no mide nada: el propio `View` de la raíz responde en el origen y el botón donde se diga. */
  function measureEverythingAt(x: number, y: number, width: number, height: number) {
    const proto = View.prototype as unknown as {
      measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
    };
    const original = proto.measureInWindow;
    proto.measureInWindow = (cb) => cb(x, y, width, height);
    return () => {
      proto.measureInWindow = original;
    };
  }

  function anchorAt() {
    return {
      current: {
        measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) =>
          cb(300, 60, 80, 36),
      } as unknown as View,
    } as unknown as ComponentProps<typeof FiltersSpotlight>['anchorRef'];
  }

  it('sin medir el botón no pinta nada encima', async () => {
    await render(<FiltersSpotlight anchorRef={{ current: null }} />);

    expect(screen.getByTestId('filters-tour')).toBeTruthy();
    expect(screen.queryByText(TOUR_STEPS[FILTERS_STEP].title)).toBeNull();
  });

  it('con el botón medido, lo marca y explica el último paso', async () => {
    const restore = measureEverythingAt(0, 0, 0, 0);
    try {
      await render(<FiltersSpotlight anchorRef={anchorAt()} />);

      expect(await screen.findByText(TOUR_STEPS[FILTERS_STEP].title)).toBeTruthy();
      expect(screen.getByText(/Toca para empezar/)).toBeTruthy();
    } finally {
      restore();
    }
  });
});
