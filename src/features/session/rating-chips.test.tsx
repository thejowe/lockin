/**
 * Los tres chips de la valoración: marcado accesible y qué valor sale al tocar.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { RatingChips } from './rating-chips';

async function renderChips(overrides: Partial<Parameters<typeof RatingChips>[0]> = {}) {
  const onSelect = jest.fn();
  await render(<RatingChips onSelect={onSelect} {...overrides} />);
  return { onSelect };
}

describe('RatingChips', () => {
  it('son tres radios con su etiqueta y ninguno marcado de salida', async () => {
    await renderChips();

    const chips = screen.getAllByRole('radio');
    expect(chips.map((chip) => chip.props.accessibilityLabel)).toEqual(['Floja', 'Bien', 'Genial']);
    for (const chip of chips) {
      expect(chip.props.accessibilityState).toMatchObject({ checked: false });
    }
  });

  it('al tocar uno sale su valor de dominio, no su etiqueta', async () => {
    const { onSelect } = await renderChips();

    await fireEvent.press(screen.getByRole('radio', { name: 'Floja' }));

    expect(onSelect).toHaveBeenCalledWith('floja');
  });

  it('la ya escrita se enseña marcada', async () => {
    await renderChips({ selected: 'genial' });

    expect(screen.getByRole('radio', { name: 'Genial' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByRole('radio', { name: 'Bien' }).props.accessibilityState).toMatchObject({
      checked: false,
    });
  });

  it('deshabilitados no llaman a nadie', async () => {
    const { onSelect } = await renderChips({ disabled: true });

    await fireEvent.press(screen.getByRole('radio', { name: 'Bien' }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'Bien' })).toBeDisabled();
  });
});
