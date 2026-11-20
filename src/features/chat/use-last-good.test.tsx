import { renderHook } from '@testing-library/react-native';

import { useLastGood } from './use-last-good';

type Props = { data: string | null; error: Error | null; loading: boolean; key?: string };

const run = (initialProps: Props) =>
  renderHook((props: Props) => useLastGood(props, props.key ?? 'a'), { initialProps });

describe('useLastGood', () => {
  it('conserva el dato tras un fallo, durante el reintento y hasta el siguiente éxito', async () => {
    const { result, rerender } = await run({ data: 'borrador', error: null, loading: false });
    expect(result.current.data).toBe('borrador');
    await rerender({ data: null, error: new Error('red'), loading: false });
    expect(result.current).toMatchObject({ data: 'borrador', loading: false });
    // Reintento en vuelo: useQuery vuelve a dar data null con loading.
    await rerender({ data: null, error: null, loading: true });
    expect(result.current).toMatchObject({ data: 'borrador', loading: false });
    await rerender({ data: 'nuevo', error: null, loading: false });
    expect(result.current.data).toBe('nuevo');
  });

  it('un null resuelto sin error manda: lo que ya no existe deja de verse', async () => {
    const { result, rerender } = await run({ data: 'match', error: null, loading: false });
    await rerender({ data: null, error: null, loading: false });
    expect(result.current.data).toBeNull();
    await rerender({ data: null, error: new Error('red'), loading: false });
    expect(result.current.data).toBeNull();
  });

  it('no arrastra el dato de otra consulta', async () => {
    const { result, rerender } = await run({ data: 'a', error: null, loading: false, key: 'a' });
    await rerender({ data: null, error: null, loading: true, key: 'b' });
    expect(result.current).toMatchObject({ data: null, loading: true });
  });
});
