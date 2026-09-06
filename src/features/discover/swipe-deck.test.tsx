/**
 * Tests del deck de swipe.
 *
 * `use-deck` ya cubre qué se hace con una decisión; aquí se cubre cómo nace:
 * el gesto. Las reglas que se guardan son las tres que hacen que el swipe se
 * sienta bien y que un refactor puede invertir sin que nada falle en compilación
 * — el umbral de desplazamiento, el flick corto pero rápido, y que un arrastre
 * insuficiente devuelva la tarjeta sin decidir.
 *
 * Cómo se dispara el gesto: `withTestId` en `swipe-deck.tsx` marca el `Gesture.Pan`,
 * `getByGestureTestId` lo recupera y `fireGestureHandler` le inyecta la secuencia
 * de eventos nativos. Es la vía oficial de `react-native-gesture-handler` para la
 * API nueva de gestos — el `jestSetup` que ya carga `jest.setup.js` solo evita que
 * el módulo nativo reviente, no permite emitir eventos.
 *
 * El mock de Reanimated resuelve `withTiming` al instante y llama a su callback,
 * así que la animación de salida termina dentro del mismo `act`.
 */

import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { State } from 'react-native-gesture-handler';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { buildProfile } from '@/data/test-fixtures';

import { PAN_TEST_ID, SwipeDeck } from './swipe-deck';

import type { PanGesture } from 'react-native-gesture-handler';
import type { Profile } from '@/data';

/** Umbral de desplazamiento del componente. Duplicado a propósito: si cambia allí, el test debe caerse. */
const THRESHOLD = 110;
/** Velocidad a la que un flick decide sin llegar al umbral. */
const FLICK = 800;

const PROFILES: Profile[] = [
  buildProfile({ id: 'p1', name: 'Núria Bosch', avatar: { initials: 'NB', accent: 'teal' } }),
  buildProfile({ id: 'p2', name: 'Marc Oller', avatar: { initials: 'MO', accent: 'brass' } }),
  buildProfile({ id: 'p3', name: 'Alba Ferrer', avatar: { initials: 'AF', accent: 'teal' } }),
  buildProfile({ id: 'p4', name: 'Diego Sanz', avatar: { initials: 'DS', accent: 'brass' } }),
];

let onDecide: jest.Mock;

/** Monta el deck con los perfiles dados. */
async function renderDeck(profiles: Profile[] = PROFILES) {
  return render(<SwipeDeck profiles={profiles} onDecide={onDecide} />);
}

/**
 * Arrastra la tarjeta superior y la suelta.
 *
 * La secuencia importa: el evento que estrena el estado ACTIVE abre el gesto, y
 * los que vienen después sin `state` son los que llegan a `onUpdate` — que es
 * donde el componente guarda el desplazamiento que luego juzga al soltar. Sin
 * ese evento intermedio, el gesto se cierra con la tarjeta todavía en el centro.
 */
function swipe({ translationX, velocityX = 0 }: { translationX: number; velocityX?: number }) {
  fireGestureHandler<PanGesture>(getByGestureTestId(PAN_TEST_ID), [
    { state: State.BEGAN, translationX: 0, translationY: 0 },
    { state: State.ACTIVE, translationX: translationX / 2, translationY: 0 },
    { translationX, translationY: 0 },
    { state: State.END, translationX, translationY: 0, velocityX, velocityY: 0 },
  ]);
}

beforeEach(() => {
  onDecide = jest.fn();
});

describe('SwipeDeck', () => {
  it('pinta la tarjeta superior con los datos del primer perfil', async () => {
    await renderDeck();

    expect(screen.getByText('Núria Bosch')).toBeOnTheScreen();
  });

  it('no pinta más de tres tarjetas por muy largo que sea el deck', async () => {
    await renderDeck();

    // Las de detrás llevan `aria-hidden`, así que hay que pedirlas explícitamente.
    expect(screen.getByText('Alba Ferrer', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByText('Diego Sanz', { includeHiddenElements: true })).toBeNull();
  });

  it('el botón Like decide sobre la tarjeta superior', async () => {
    await renderDeck();

    await fireEvent.press(screen.getByLabelText('Like'));

    expect(onDecide).toHaveBeenCalledWith(PROFILES[0], 'like');
  });

  it('el botón Pasar decide sobre la tarjeta superior', async () => {
    await renderDeck();

    await fireEvent.press(screen.getByLabelText('Pasar'));

    expect(onDecide).toHaveBeenCalledWith(PROFILES[0], 'pass');
  });

  it('con el deck agotado no hay nada que decidir', async () => {
    await renderDeck([]);

    expect(screen.getByLabelText('Like')).toBeDisabled();
    expect(screen.getByLabelText('Pasar')).toBeDisabled();

    await fireEvent.press(screen.getByLabelText('Like'));
    expect(onDecide).not.toHaveBeenCalled();
  });

  it('arrastrar más allá del umbral hacia la derecha es un like', async () => {
    await renderDeck();

    swipe({ translationX: THRESHOLD + 20 });

    expect(onDecide).toHaveBeenCalledWith(PROFILES[0], 'like');
  });

  it('arrastrar más allá del umbral hacia la izquierda es un pass', async () => {
    await renderDeck();

    swipe({ translationX: -(THRESHOLD + 20) });

    expect(onDecide).toHaveBeenCalledWith(PROFILES[0], 'pass');
  });

  it('un arrastre corto devuelve la tarjeta sin decidir', async () => {
    await renderDeck();

    swipe({ translationX: THRESHOLD - 1 });

    expect(onDecide).not.toHaveBeenCalled();
  });

  it('un flick corto pero rápido decide igual', async () => {
    await renderDeck();

    swipe({ translationX: 20, velocityX: FLICK + 1 });

    expect(onDecide).toHaveBeenCalledWith(PROFILES[0], 'like');
  });

  it('el flick rápido hacia la izquierda también decide', async () => {
    await renderDeck();

    swipe({ translationX: -20, velocityX: -(FLICK + 1) });

    expect(onDecide).toHaveBeenCalledWith(PROFILES[0], 'pass');
  });

  it('una velocidad por debajo del flick no decide si el arrastre es corto', async () => {
    await renderDeck();

    swipe({ translationX: 20, velocityX: FLICK - 1 });

    expect(onDecide).not.toHaveBeenCalled();
  });

  it('cada decisión es una sola: la tarjeta no se decide dos veces', async () => {
    await renderDeck();

    swipe({ translationX: THRESHOLD + 20 });
    swipe({ translationX: THRESHOLD + 20 });

    // El padre saca la tarjeta del deck entre swipe y swipe; aquí el deck no
    // cambia, así que lo único que se comprueba es que cada gesto cierra una
    // decisión y no deja el bloqueo puesto.
    expect(onDecide).toHaveBeenCalledTimes(2);
    expect(onDecide).toHaveBeenLastCalledWith(PROFILES[0], 'like');
  });
});
