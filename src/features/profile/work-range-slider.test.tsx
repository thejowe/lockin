import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import type { WorkRange } from '@/data/work-range';
import { WorkRangeEditor, WorkRangeSlider } from './work-range-slider';

function Editor({ startMin = 540, endMin = 840 }) {
  const [range, setRange] = useState<WorkRange>({ startMin, endMin });
  return <WorkRangeSlider value={range} onChange={setRange} />;
}

function RangeList({ first = { startMin: 540, endMin: 840 } }) {
  const [ranges, setRanges] = useState<WorkRange[]>([first]);
  return <WorkRangeEditor value={ranges} onChange={setRanges} />;
}

const surface = (index = 0) => screen.getAllByTestId('work-range-touch')[index];
const start = () => screen.getByRole('adjustable', { name: 'Inicio de la jornada' });
const end = () => screen.getByRole('adjustable', { name: 'Fin de la jornada' });

// 480 puntos útiles y 44 a cada lado. 10 puntos equivalen a media hora.
async function layout(index = 0) {
  await fireEvent.layout(surface(index).parent!, { width: 568, height: 44, x: 0, y: 0 });
}

// RNTL llama a onStartShouldSetResponder() sin coordenadas al resolver fireEvent.
// Aquí reproducimos la negociación del sistema con el punto de toque real.
async function touch(
  event: 'responderGrant' | 'responderMove' | 'responderRelease',
  x: number,
  index = 0
) {
  const nativeTouch = { nativeEvent: { locationX: x, pageX: x + 32 } };
  const props = surface(index).props;
  if (event === 'responderGrant') expect(props.onStartShouldSetResponder(nativeTouch)).toBe(true);
  const handler = {
    responderGrant: props.onResponderGrant,
    responderMove: props.onResponderMove,
    responderRelease: props.onResponderRelease,
  }[event];
  await act(() => handler(nativeTouch));
}

function adjust(element: ReturnType<typeof start>, actionName: 'increment' | 'decrement') {
  return fireEvent(element, 'accessibilityAction', { nativeEvent: { actionName } });
}

afterEach(() => jest.restoreAllMocks());

describe('selector de jornada', () => {
  const add = () => screen.getByRole('button', { name: '+ Añadir otro tramo' });

  it('añade y quita el segundo tramo e impide solapes al arrastrar desde ambas barras', async () => {
    await render(<RangeList />);
    expect(screen.getAllByRole('adjustable')).toHaveLength(2);
    await fireEvent.press(add());
    expect(screen.getAllByRole('adjustable')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: '+ Añadir otro tramo' })).toBeNull();
    await layout(0);
    await layout(1);
    // El segundo tramo empieza a las 15. Un arrastre más allá de las 09 para a las 14.
    await touch('responderGrant', 344, 1);
    await touch('responderRelease', 180, 1);
    expect(screen.getByText('De 14:00 a 16:00')).toBeTruthy();
    await touch('responderGrant', 324, 0);
    await touch('responderRelease', 440, 0);
    expect(screen.getByText('De 09:00 a 14:00')).toBeTruthy();
    const secondStart = screen.getByRole('adjustable', { name: 'Inicio del tramo 2' });
    expect(secondStart).toHaveAccessibilityValue({ min: 840, max: 900, text: '14:00' });
    await adjust(secondStart, 'increment');
    await touch('responderGrant', 324);
    await touch('responderRelease', 440);
    expect(screen.getByText('De 09:00 a 14:30')).toBeTruthy();
    expect(screen.getByText('De 14:30 a 16:00')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Quitar el segundo tramo' }));
    expect(screen.getAllByRole('adjustable')).toHaveLength(2);
    expect(end()).toHaveAccessibilityValue({ max: 1440, text: '14:30' });
    expect(add()).toBeTruthy();
  });

  it('permite añadir antes del primer tramo si este termina en 24:00', async () => {
    await render(<RangeList first={{ startMin: 1380, endMin: 1440 }} />);
    await fireEvent.press(add());
    expect(screen.getByText('De 21:00 a 22:00')).toBeTruthy();
    const secondEnd = screen.getByRole('adjustable', { name: 'Fin del tramo 2' });
    await adjust(secondEnd, 'increment');
    await adjust(secondEnd, 'increment');
    await adjust(secondEnd, 'increment');
    expect(secondEnd).toHaveAccessibilityValue({ max: 1380, text: '23:00' });
    expect(screen.getByText('De 23:00 a 24:00')).toBeTruthy();
  });

  it('divide un día completo en dos sin perder minutos disponibles', async () => {
    await render(<RangeList first={{ startMin: 0, endMin: 1440 }} />);
    await fireEvent.press(add());
    expect(screen.getByText('De 00:00 a 23:00')).toBeTruthy();
    expect(screen.getByText('De 23:00 a 24:00')).toBeTruthy();
  });

  it('encaja el arrastre a media hora y vibra al atravesar horas enteras en ambos sentidos', async () => {
    const haptic = jest.spyOn(Haptics, 'selectionAsync').mockResolvedValue();
    await render(<Editor />);
    await layout();
    await touch('responderGrant', 224); // 09:00
    await touch('responderMove', 228);
    expect(start()).toHaveAccessibilityValue({ text: '09:00' });
    await touch('responderMove', 232);
    expect(start()).toHaveAccessibilityValue({ text: '09:30' });
    expect(haptic).toHaveBeenCalledTimes(0);
    await touch('responderMove', 255); // el evento ha saltado la posición de las 10:00
    expect(start()).toHaveAccessibilityValue({ text: '10:30' });
    expect(haptic).toHaveBeenCalledTimes(1);
    await touch('responderMove', 244);
    await touch('responderRelease', 244);
    expect(screen.getByText('De 10:00 a 14:00')).toBeTruthy();
    expect(haptic).toHaveBeenCalledTimes(2);
    await touch('responderGrant', 244);
    await touch('responderRelease', 184); // un único evento de 10:00 a 07:00
    expect(haptic).toHaveBeenCalledTimes(5);
  });

  it('mantiene una hora de distancia y permite arrastrar cualquiera de dos tiradores cercanos', async () => {
    await render(<Editor endMin={600} />);
    await layout();
    await touch('responderGrant', 233); // a 9 puntos del inicio y 11 del fin
    await touch('responderMove', 400);
    expect(screen.getByText('De 09:00 a 10:00')).toBeTruthy();
    await touch('responderMove', 213);
    expect(screen.getByText('De 08:00 a 10:00')).toBeTruthy();
    await touch('responderRelease', 233); // vuelve a 09:00
    await touch('responderGrant', 235); // ahora el más cercano es el fin
    await touch('responderMove', 100);
    expect(screen.getByText('De 09:00 a 10:00')).toBeTruthy();
    await touch('responderRelease', 255);
    expect(screen.getByText('De 09:00 a 11:00')).toBeTruthy();
  });

  it.each([
    [0, 60],
    [1380, 1440],
  ])('conserva dos blancos táctiles de 44 puntos entre %i y %i', async (from, to) => {
    await render(<Editor startMin={from} endMin={to} />);
    await layout();
    const left = StyleSheet.flatten(start().props.style);
    const right = StyleSheet.flatten(end().props.style);
    expect(left.width).toBe(44);
    expect(right.width).toBe(44);
    expect(left.height).toBe(44);
    expect(right.height).toBe(44);
    expect(left.left).toBeGreaterThanOrEqual(0);
    expect(left.left + left.width).toBeLessThanOrEqual(right.left);
    expect(right.left + right.width).toBeLessThanOrEqual(568);
    await touch('responderGrant', left.left + 0.5);
    await touch('responderRelease', left.left + 0.5);
    await touch('responderGrant', right.left + right.width - 0.5);
    await touch('responderRelease', right.left + right.width - 0.5);
  });

  it('anuncia ambos valores y sus límites y acepta los gestos de subir y bajar', async () => {
    await render(<Editor startMin={0} endMin={60} />);
    expect(start()).toHaveAccessibilityValue({ min: 0, max: 0, now: 0, text: '00:00' });
    expect(end()).toHaveAccessibilityValue({ min: 60, max: 1440, now: 60, text: '01:00' });
    await adjust(start(), 'increment');
    await adjust(end(), 'decrement');
    expect(screen.getByText('De 00:00 a 01:00')).toBeTruthy();
    await adjust(end(), 'increment');
    await adjust(start(), 'increment');
    expect(screen.getByText('De 00:30 a 01:30')).toBeTruthy();
    await adjust(start(), 'decrement');
    expect(start()).toHaveAccessibilityValue({ text: '00:00' });
  });

  it('alcanza 00 y 24, limita los arrastres fuera de la pista y muestra las cinco marcas', async () => {
    await render(<Editor />);
    await layout();
    await touch('responderGrant', 224);
    await touch('responderRelease', -100);
    await touch('responderGrant', 324);
    await touch('responderRelease', 600);
    expect(screen.getByText('De 00:00 a 24:00')).toBeTruthy();
    expect(end()).toHaveAccessibilityValue({ now: 1440 });
    for (const tick of ['00', '06', '12', '20', '24']) {
      expect(screen.getByText(tick, { includeHiddenElements: true })).toBeTruthy();
    }
  });
});
