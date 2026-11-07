/**
 * `useTabEntering` sin argumento y con la pestaña fuera de pantalla: el índice
 * por defecto es 0 y, sin foco, ninguna de las dos entradas existe.
 */

import { renderHook } from '@testing-library/react-native';

import { useTabEntering } from '@/components/motion';

const mockPage = { focused: true };

jest.mock('@/components/swipe-between-tabs', () => ({
  usePageFocused: () => mockPage.focused,
}));

describe('useTabEntering', () => {
  it('en pantalla devuelve las dos entradas, con el puesto 0 por defecto', async () => {
    mockPage.focused = true;
    const { result } = await renderHook(() => useTabEntering());

    expect(result.current.up()).toBeTruthy();
    expect(result.current.fade()).toBeTruthy();
  });

  it('fuera de pantalla no devuelve ninguna', async () => {
    mockPage.focused = false;
    const { result } = await renderHook(() => useTabEntering());

    expect(result.current.up()).toBeUndefined();
    expect(result.current.fade()).toBeUndefined();
  });
});
