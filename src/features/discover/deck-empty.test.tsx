/**
 * Tests del deck agotado.
 *
 * Desde que el deck es solo de cofundador (2026-10-12) no hay filtro que
 * cambiar, así que el vacío nunca debe mandar a tocarlo: solo puede decir que
 * no queda nadie por ahora y ofrecer las dos salidas.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { DeckEmpty } from './deck-empty';

function setup() {
  const onOpenMatches = jest.fn();
  const onRefresh = jest.fn();
  return {
    onOpenMatches,
    onRefresh,
    ui: <DeckEmpty onOpenMatches={onOpenMatches} onRefresh={onRefresh} />,
  };
}

describe('DeckEmpty', () => {
  it('presenta el vacío como un final normal, no como un error', async () => {
    const { ui } = setup();
    await render(ui);

    expect(screen.getByText('Deck vacío')).toBeTruthy();
    expect(screen.getByText('Ya has visto a todo el mundo')).toBeTruthy();
  });

  it('no manda a cambiar ningún filtro: ya no hay ninguno', async () => {
    const { ui } = setup();
    await render(ui);

    expect(screen.getByText(/No quedan perfiles nuevos por decidir/)).toBeTruthy();
    expect(screen.queryByText(/filtro/)).toBeNull();
  });

  it('ofrece las dos salidas: ver matches y volver a comprobar', async () => {
    const { onOpenMatches, onRefresh, ui } = setup();
    await render(ui);

    await fireEvent.press(screen.getByText('Ver mis matches'));
    expect(onOpenMatches).toHaveBeenCalledTimes(1);
    expect(onRefresh).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Volver a comprobar'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('sin onUndo no ofrece Deshacer', async () => {
    const { ui } = setup();
    await render(ui);

    expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull();
  });

  it('con onUndo deja deshacer la última decisión aunque no queden tarjetas', async () => {
    const onUndo = jest.fn();
    await render(<DeckEmpty onOpenMatches={jest.fn()} onRefresh={jest.fn()} onUndo={onUndo} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Deshacer' }));

    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
