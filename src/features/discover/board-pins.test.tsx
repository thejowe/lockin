import { fireEvent, render, screen } from '@testing-library/react-native';
import { BoardPins } from './board-pins';

it('limita el tablón a seis fotos y permite abrir y cerrar tanto una foto con pie como una sin él', async () => {
  const posts = Array.from({ length: 7 }, (_, index) => ({
    id: String(index),
    ownerId: 'ana',
    caption: index ? 'Foto ' + index : '',
    createdAt: '2026-11-01',
    imageUrl: 'https://example.org/' + index + '.jpg',
  }));
  await render(<BoardPins posts={posts} ownerName="Ana" />);
  expect(screen.getAllByRole('imagebutton')).toHaveLength(6);
  expect(screen.queryByLabelText('Foto 6')).toBeNull();
  for (const name of ['Foto 1', 'Foto personal de Ana']) {
    const stopPropagation = jest.fn();
    await fireEvent.press(screen.getByRole('imagebutton', { name }), { stopPropagation });
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    const close = screen.getByRole('button', { name: 'Cerrar' });
    if (name === 'Foto 1') expect(screen.getByText('Foto 1')).toBeOnTheScreen();
    await fireEvent.press(close);
    expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull();
  }
});
