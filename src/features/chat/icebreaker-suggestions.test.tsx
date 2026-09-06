/**
 * Tests de las aperturas sugeridas.
 *
 * Dos reglas sostienen esta pieza. La primera es que pulsar una sugerencia NO
 * la envía: la vuelca en el campo para poder editarla, y eso solo se ve desde
 * fuera en la pista de accesibilidad y en qué recibe `onPick`. La segunda es
 * que sin sugerencias no debe quedar un titular "Para romper el hielo"
 * colgando sobre un hueco vacío.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { IcebreakerSuggestions } from './icebreaker-suggestions';

const SUGGESTIONS = ['¿Qué estás construyendo?', '¿Cuándo sueles trabajar?'];

function setup(suggestions: string[] = SUGGESTIONS) {
  const onPick = jest.fn();
  return { onPick, ui: <IcebreakerSuggestions suggestions={suggestions} onPick={onPick} /> };
}

describe('IcebreakerSuggestions', () => {
  it('pinta una opción por sugerencia, bajo su titular', async () => {
    const { ui } = setup();
    await render(ui);

    expect(screen.getByText('Para romper el hielo')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(SUGGESTIONS.length);
    for (const suggestion of SUGGESTIONS) {
      expect(screen.getByText(suggestion)).toBeTruthy();
    }
  });

  it('sin sugerencias no deja el titular colgando: no pinta nada', async () => {
    const { ui } = setup([]);
    await render(ui);

    expect(screen.queryByText('Para romper el hielo')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('devuelve la frase elegida, no su índice', async () => {
    const { onPick, ui } = setup();
    await render(ui);

    await fireEvent.press(screen.getByText(SUGGESTIONS[1]));

    expect(onPick).toHaveBeenCalledWith(SUGGESTIONS[1]);
  });

  it('avisa de que se escribe en el campo y no se envía', async () => {
    const { ui } = setup();
    await render(ui);

    for (const button of screen.getAllByRole('button')) {
      expect(button.props.accessibilityHint).toBe(
        'Escribe esta frase en el campo de mensaje para que puedas editarla'
      );
    }
  });

  it('deja alcanzable la sugerencia de 36 px con hitSlop vertical', async () => {
    const { ui } = setup();
    await render(ui);

    for (const button of screen.getAllByRole('button')) {
      expect(button.props.hitSlop).toEqual({ top: 4, bottom: 4 });
    }
  });
});
