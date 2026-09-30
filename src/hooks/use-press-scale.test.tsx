/**
 * El press state cede bajo el dedo y vuelve al soltar; con «reducir
 * movimiento» no escala nada.
 *
 * El mock de Reanimated crea un shared value nuevo en cada render, así que la
 * escala no se puede leer de vuelta: se comprueba a qué destino se manda el
 * muelle.
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';
import { AccessibilityInfo } from 'react-native';
import { withSpring } from 'react-native-reanimated';

import { PressScale, Springs } from '@/constants/theme';
import { usePressScale } from '@/hooks/use-press-scale';

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual<object>('react-native-reanimated/mock'),
  withSpring: jest.fn((toValue: number) => toValue),
}));

afterEach(() => {
  jest.restoreAllMocks();
  jest.mocked(withSpring).mockClear();
});

describe('usePressScale', () => {
  it('cede al pulsar y vuelve al soltar, con el muelle de press', async () => {
    const view = await renderHook(() => usePressScale());

    await act(async () => view.result.current.onPressIn());
    expect(withSpring).toHaveBeenLastCalledWith(PressScale, Springs.press);

    await act(async () => view.result.current.onPressOut());
    expect(withSpring).toHaveBeenLastCalledWith(1, Springs.press);
  });

  it('con «reducir movimiento» no anima', async () => {
    const asked = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const view = await renderHook(() => usePressScale());
    await waitFor(() => expect(asked).toHaveBeenCalled());
    await act(async () => {});

    await act(async () => view.result.current.onPressIn());
    await act(async () => view.result.current.onPressOut());
    expect(withSpring).not.toHaveBeenCalled();
  });
});
