/**
 * La variante web del esquema de color: en el servidor (render estático) no hay
 * esquema que leer y devuelve `light`; ya hidratado en el cliente, el del sistema.
 */

import { renderHook } from '@testing-library/react-native';
// @ts-expect-error -- react-dom no trae tipos en este proyecto (solo se usa aquí, para el render estático)
import { renderToString } from 'react-dom/server';
import * as ReactNative from 'react-native';

import { useColorScheme } from './use-color-scheme.web';

afterEach(() => jest.restoreAllMocks());

describe('useColorScheme (web)', () => {
  it('ya hidratado devuelve el esquema del sistema', async () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    const { result } = await renderHook(() => useColorScheme());

    expect(result.current).toBe('dark');
  });

  it('en el render estático no se sabe el esquema: `light`, para que el HTML coincida', () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
    let seen: string | null | undefined;

    function Probe() {
      seen = useColorScheme();
      return null;
    }
    renderToString(<Probe />);

    expect(seen).toBe('light');
  });
});
