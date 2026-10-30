/**
 * La fila «Te han dado like (N)» de Matches: no se pinta sin likes y avisa al tocarla.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { LikesRow } from './likes-row';

describe('LikesRow', () => {
  it('dice cuántos likes hay', async () => {
    await render(<LikesRow count={3} onPress={jest.fn()} />);

    expect(screen.getByText('Te han dado like (3)')).toBeTruthy();
  });

  it('con cero likes no pinta nada', async () => {
    await render(<LikesRow count={0} onPress={jest.fn()} />);

    expect(screen.queryByText(/Te han dado like/)).toBeNull();
  });

  it('al tocarla avisa', async () => {
    const onPress = jest.fn();
    await render(<LikesRow count={2} onPress={onPress} />);

    await fireEvent.press(screen.getByText('Te han dado like (2)'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
