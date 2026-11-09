/**
 * El deck de los grupos: el mismo contrato de gesto que el de Descubrir —umbral,
 * flick, vuelta al centro— y los dos botones. Cómo se inyecta el gesto está
 * explicado en `features/discover/swipe-deck.test.tsx`.
 */

import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { GestureHandlerRootView, State } from 'react-native-gesture-handler';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react-native';
import { act } from 'react';
import { AccessibilityInfo, Text } from 'react-native';

import {
  DecisionDeck,
  FLICK_VELOCITY,
  GROUP_PAN_TEST_ID,
  SWIPE_THRESHOLD,
  swipeOutcome,
} from './decision-deck';

import type { LegacyPanGesture } from 'react-native-gesture-handler';

const render: typeof rtlRender = (ui, options) =>
  rtlRender(ui, { wrapper: GestureHandlerRootView, ...options });

// El mock oficial crea un valor nuevo en cada render; aquí se conserva, como en la app.
jest.mock('react-native-reanimated', () => {
  const reanimated = jest.requireActual('react-native-reanimated/mock');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useRef } = require('react');
  return {
    ...reanimated,
    useSharedValue: (init: unknown) => {
      const ref = useRef(null);
      if (ref.current === null) ref.current = reanimated.useSharedValue(init);
      return ref.current;
    },
  };
});

const ITEMS = ['uno', 'dos', 'tres'];
let onDecide: jest.Mock;

async function renderDeck(props: Partial<React.ComponentProps<typeof DecisionDeck<string>>> = {}) {
  return render(
    <DecisionDeck
      items={ITEMS}
      keyOf={(item) => item}
      renderCard={(item, top) => <Text>{top ? `arriba ${item}` : `detrás ${item}`}</Text>}
      onDecide={onDecide}
      likeLabel="Me gusta"
      passLabel="Pasar"
      {...props}
    />
  );
}

async function swipe(translationX: number, velocityX = 0) {
  await act(async () => {
    fireGestureHandler<LegacyPanGesture>(getByGestureTestId(GROUP_PAN_TEST_ID), [
      { state: State.BEGAN, translationX: 0, translationY: 0 },
      { state: State.ACTIVE, translationX: translationX / 2, translationY: 0 },
      // Sin este evento intermedio el gesto se cierra con la carta en el centro.
      { translationX, translationY: 0 },
      { state: State.END, translationX, translationY: 0, velocityX, velocityY: 0 },
    ]);
  });
}

beforeEach(() => {
  onDecide = jest.fn();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

afterEach(() => jest.restoreAllMocks());

describe('swipeOutcome', () => {
  it('decide por umbral o por velocidad, y si no, nada', () => {
    expect(swipeOutcome(SWIPE_THRESHOLD + 1, 0)).toBe('like');
    expect(swipeOutcome(-SWIPE_THRESHOLD - 1, 0)).toBe('pass');
    expect(swipeOutcome(20, FLICK_VELOCITY + 1)).toBe('like');
    expect(swipeOutcome(-20, -FLICK_VELOCITY - 1)).toBe('pass');
    expect(swipeOutcome(SWIPE_THRESHOLD, FLICK_VELOCITY)).toBeNull();
  });
});

describe('DecisionDeck', () => {
  it('pinta la de arriba y la siguiente, y nada más', async () => {
    await renderDeck();
    expect(screen.getByText('arriba uno')).toBeTruthy();
    expect(screen.getByText('detrás dos', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText(/tres/)).toBeNull();
  });

  it('los botones deciden sobre la de arriba', async () => {
    await renderDeck();
    await fireEvent.press(screen.getByRole('button', { name: 'Me gusta' }));
    expect(onDecide).toHaveBeenCalledWith('uno', 'like');

    await fireEvent.press(screen.getByRole('button', { name: 'Pasar' }));
    expect(onDecide).toHaveBeenLastCalledWith('uno', 'pass');
  });

  it('arrastrar más allá del umbral decide; quedarse corto, no', async () => {
    await renderDeck();
    await swipe(SWIPE_THRESHOLD - 10);
    expect(onDecide).not.toHaveBeenCalled();

    await swipe(SWIPE_THRESHOLD + 10);
    expect(onDecide).toHaveBeenCalledWith('uno', 'like');
  });

  it('un arrastre a la izquierda o un flick corto también deciden', async () => {
    const view = await renderDeck();
    await swipe(-SWIPE_THRESHOLD - 10);
    expect(onDecide).toHaveBeenLastCalledWith('uno', 'pass');

    // Al retirarse la carta decidida, la siguiente empieza un turno nuevo.
    await view.rerender(
      <DecisionDeck
        items={['dos', 'tres']}
        keyOf={(item) => item}
        renderCard={(item) => <Text>{item}</Text>}
        onDecide={onDecide}
        likeLabel="Me gusta"
        passLabel="Pasar"
      />
    );
    await swipe(30, FLICK_VELOCITY + 100);
    expect(onDecide).toHaveBeenLastCalledWith('dos', 'like');
  });

  it('con «reducir movimiento» decide igual, sin recorrido', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await renderDeck();
    await act(async () => {});

    await swipe(SWIPE_THRESHOLD - 10);
    expect(onDecide).not.toHaveBeenCalled();
    await swipe(SWIPE_THRESHOLD + 10);
    expect(onDecide).toHaveBeenCalledWith('uno', 'like');
    await fireEvent.press(screen.getByRole('button', { name: 'Pasar' }));
    expect(onDecide).toHaveBeenLastCalledWith('uno', 'pass');
  });

  it('desactivado no enseña botones ni decide', async () => {
    await renderDeck({ disabled: true });
    expect(screen.queryByRole('button', { name: 'Me gusta' })).toBeNull();
  });

  it('sin cartas, los botones no hacen nada', async () => {
    await renderDeck({ items: [] });
    await fireEvent.press(screen.getByRole('button', { name: 'Me gusta' }));
    expect(onDecide).not.toHaveBeenCalled();
  });
});
