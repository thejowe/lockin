/**
 * Tests del deck agotado.
 *
 * Lo único que decide este componente es el motivo del vacío: con el filtro en
 * "ambos" no quedan perfiles en toda la app, y con un modo concreto puede que
 * solo falten en ese modo. Decir lo segundo cuando toca lo primero deja a la
 * persona cambiando de filtro para siempre, así que esa rama se prueba.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { DeckEmpty } from './deck-empty';

import type { ModePreference } from '@/data';

function setup(mode: ModePreference = 'ambos') {
  const onOpenMatches = jest.fn();
  const onRefresh = jest.fn();
  return {
    onOpenMatches,
    onRefresh,
    ui: <DeckEmpty mode={mode} onOpenMatches={onOpenMatches} onRefresh={onRefresh} />,
  };
}

describe('DeckEmpty', () => {
  it('presenta el vacío como un final normal, no como un error', async () => {
    const { ui } = setup();
    await render(ui);

    expect(screen.getByText('Deck vacío')).toBeTruthy();
    expect(screen.getByText('Ya has visto a todo el mundo')).toBeTruthy();
  });

  it('con el filtro en "ambos" no manda a tocar el filtro: no hay otro que probar', async () => {
    const { ui } = setup('ambos');
    await render(ui);

    expect(screen.getByText(/No quedan perfiles nuevos por decidir/)).toBeTruthy();
    expect(screen.queryByText(/cambiar el filtro/)).toBeNull();
  });

  it.each(['par', 'lockin'] as const)(
    'con el filtro en %s sugiere ampliarlo, que es lo que falta',
    async (mode) => {
      const { ui } = setup(mode);
      await render(ui);

      expect(screen.getByText(/No quedan perfiles nuevos en este modo/)).toBeTruthy();
      expect(screen.getByText(/cambiar el filtro de arriba/)).toBeTruthy();
    }
  );

  it('ofrece las dos salidas: ver matches y volver a comprobar', async () => {
    const { onOpenMatches, onRefresh, ui } = setup();
    await render(ui);

    await fireEvent.press(screen.getByText('Ver mis matches'));
    expect(onOpenMatches).toHaveBeenCalledTimes(1);
    expect(onRefresh).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Volver a comprobar'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
