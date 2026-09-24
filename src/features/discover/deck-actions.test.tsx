/**
 * Pasar y Like son la alternativa accesible al swipe: deben comunicar la misma
 * decisión y explicar su efecto. Mientras están deshabilitados no pueden
 * enviar decisiones, aunque la persona intente pulsarlos.
 *
 * En RNTL 14 tanto render como fireEvent son asíncronos.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { DeckActions } from './deck-actions';

function setup(disabled = false) {
  const onDecide = jest.fn();
  return { onDecide, ui: <DeckActions onDecide={onDecide} disabled={disabled} /> };
}

describe('DeckActions', () => {
  it.each([
    ['Pasar', 'pass'],
    ['Like', 'like'],
  ] as const)('al pulsar %s comunica la decisión %s una sola vez', async (label, decision) => {
    const { onDecide, ui } = setup();
    await render(ui);

    expect(onDecide).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: label }));

    expect(onDecide).toHaveBeenCalledTimes(1);
    expect(onDecide).toHaveBeenCalledWith(decision);
  });

  it.each(['Pasar', 'Like'])('deshabilitado, pulsar %s no comunica decisiones', async (label) => {
    const { onDecide, ui } = setup(true);
    await render(ui);

    const button = screen.getByRole('button', { name: label });
    expect(button).toBeDisabled();
    await fireEvent.press(button);

    expect(onDecide).not.toHaveBeenCalled();
  });

  it.each([
    ['Pasar', 'Descartar este perfil'],
    ['Like', 'Guardar este perfil como interesante'],
  ])('expone el label %s y explica su efecto al lector de pantalla', async (label, hint) => {
    const { ui } = setup();
    await render(ui);

    expect(screen.getByText(label)).toBeVisible();
    const button = screen.getByRole('button', { name: label });
    expect(screen.getByLabelText(label)).toBe(button);
    expect(button).toHaveProp('accessibilityLabel', label);
    expect(button).toHaveProp('accessibilityHint', hint);
  });
});
