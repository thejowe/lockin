import { renderHook } from '@testing-library/react-native';

import { useLastGood } from './use-last-good';

type Props = { data: string | null; error: Error | null };

describe('useLastGood', () => {
  it('conserva el último dato mientras una relectura falla', async () => {
    const { result, rerender } = await renderHook(
      (props: Props) => useLastGood(props.data, props.error),
      {
        initialProps: { data: 'borrador', error: null },
      }
    );
    expect(result.current).toBe('borrador');
    await rerender({ data: null, error: new Error('red') });
    expect(result.current).toBe('borrador');
    await rerender({ data: 'nuevo', error: null });
    expect(result.current).toBe('nuevo');
  });

  it('un null leído sin error manda: lo que ya no existe deja de verse', async () => {
    const { result, rerender } = await renderHook(
      (props: Props) => useLastGood(props.data, props.error),
      {
        initialProps: { data: 'match', error: null },
      }
    );
    await rerender({ data: null, error: null });
    expect(result.current).toBeNull();
    await rerender({ data: null, error: new Error('red') });
    expect(result.current).toBeNull();
  });
});
