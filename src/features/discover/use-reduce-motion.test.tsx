/**
 * Tests del ajuste «reducir movimiento».
 *
 * Es una decisión de accesibilidad invisible: si el hook se queda en `false`
 * nadie lo nota en el simulador, y quien lo tiene activado se come el deck
 * entero animado. Así que aquí se guardan las cuatro cosas que puede romper un
 * refactor — la consulta inicial, el cambio en caliente, la baja al desmontar y
 * que una respuesta tardía no toque un componente que ya no está.
 *
 * `AccessibilityInfo` ya viene como doble de Jest en el preset de React Native
 * (`@react-native/jest-preset/jest/mocks/AccessibilityInfo`), y por defecto
 * responde `false` a todo. Cada test pone lo que necesita con `spyOn` y
 * `restoreAllMocks` lo deja como estaba: son `jest.fn` compartidos con el resto
 * de la suite.
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useReduceMotion } from './use-reduce-motion';

/** El handler que el hook dejó suscrito a `reduceMotionChanged`. */
function subscribedHandler(): (enabled: boolean) => void {
  const listener = jest.mocked(AccessibilityInfo.addEventListener).mock.calls.at(-1);
  if (!listener) throw new Error('El hook no se suscribió a ningún evento');

  expect(listener[0]).toBe('reduceMotionChanged');
  return listener[1] as unknown as (enabled: boolean) => void;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useReduceMotion', () => {
  it('hasta que el sistema responde, se anima', async () => {
    let answer: (enabled: boolean) => void = () => {};
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(
      new Promise<boolean>((resolve) => {
        answer = resolve;
      })
    );

    const view = await renderHook(() => useReduceMotion());

    // La consulta es asíncrona y el deck se monta antes de tener respuesta: el
    // valor de partida tiene que ser el comportamiento de siempre.
    expect(view.result.current).toBe(false);

    await act(async () => {
      answer(true);
    });
    expect(view.result.current).toBe(true);
  });

  it('con el ajuste activado en el sistema, deja de animarse', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    const view = await renderHook(() => useReduceMotion());

    await waitFor(() => expect(view.result.current).toBe(true));
  });

  it('sigue el ajuste si cambia con la app abierta', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);

    const view = await renderHook(() => useReduceMotion());
    await act(async () => {});

    const notify = subscribedHandler();
    act(() => notify(true));
    expect(view.result.current).toBe(true);

    act(() => notify(false));
    expect(view.result.current).toBe(false);
  });

  it('se da de baja del evento al desmontar', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const remove = jest.fn();
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove } as unknown as ReturnType<
        typeof AccessibilityInfo.addEventListener
      >);

    const view = await renderHook(() => useReduceMotion());
    await act(async () => {});

    expect(remove).not.toHaveBeenCalled();
    await view.unmount();
    expect(remove).toHaveBeenCalled();
  });

  it('una respuesta que llega tarde no toca un hook ya desmontado', async () => {
    let answer: (enabled: boolean) => void = () => {};
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(
      new Promise<boolean>((resolve) => {
        answer = resolve;
      })
    );

    const view = await renderHook(() => useReduceMotion());
    await view.unmount();

    // Sin la guarda de desmontado, esto sería un `setState` sobre un hook
    // muerto: React lo avisa por consola y el aviso se pierde entre el ruido.
    await act(async () => {
      answer(true);
    });

    expect(view.result.current).toBe(false);
  });
});
