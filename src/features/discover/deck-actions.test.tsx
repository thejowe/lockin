/**
 * Pasar y Like son la alternativa accesible al swipe: deben comunicar la misma
 * decisión y explicar su efecto. Mientras están deshabilitados no pueden
 * enviar decisiones, aunque la persona intente pulsarlos.
 *
 * En RNTL 14 tanto render como fireEvent son asíncronos.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { openPaywall } from '@/features/premium';

import { DeckActions } from './deck-actions';

jest.mock('@/features/premium', () => ({
  ...jest.requireActual('@/features/premium'),
  openPaywall: jest.fn(),
}));

function setup(disabled = false) {
  const onDecide = jest.fn();
  return { onDecide, ui: <DeckActions onDecide={onDecide} disabled={disabled} /> };
}

beforeEach(() => {
  jest.mocked(openPaywall).mockClear();
});

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

    // Solo icono, como en Tinder: el nombre lo lleva la etiqueta accesible.
    expect(screen.queryByText(label)).toBeNull();
    const button = screen.getByRole('button', { name: label });
    expect(screen.getByLabelText(label)).toBe(button);
    expect(button).toHaveProp('accessibilityLabel', label);
    expect(button).toHaveProp('accessibilityHint', hint);
  });

  describe('Premium', () => {
    it('pinta los cinco botones, cada uno con su nombre para el lector de pantalla', async () => {
      const { ui } = setup();
      await render(ui);

      for (const label of ['Deshacer', 'Pasar', 'Super Like', 'Like', 'Boost']) {
        expect(screen.getByRole('button', { name: label })).toBeOnTheScreen();
      }
    });

    it('sin Premium, Deshacer y Boost piden Premium y abren el paywall', async () => {
      const onUndo = jest.fn();
      const onBoost = jest.fn();
      await render(<DeckActions onDecide={jest.fn()} onUndo={onUndo} onBoost={onBoost} />);

      for (const label of ['Deshacer', 'Boost']) {
        const button = screen.getByRole('button', { name: label });
        expect(button).toHaveProp('accessibilityHint', 'Requiere Premium');
        await fireEvent.press(button);
      }

      expect(openPaywall).toHaveBeenCalledTimes(2);
      expect(onUndo).not.toHaveBeenCalled();
      expect(onBoost).not.toHaveBeenCalled();
    });

    it('con Premium, Deshacer y Boost actúan y no abren el paywall', async () => {
      const onUndo = jest.fn();
      const onBoost = jest.fn();
      await render(
        <DeckActions onDecide={jest.fn()} isPremium onUndo={onUndo} onBoost={onBoost} />
      );

      await fireEvent.press(screen.getByRole('button', { name: 'Deshacer' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Boost' }));

      expect(onUndo).toHaveBeenCalledTimes(1);
      expect(onBoost).toHaveBeenCalledTimes(1);
      expect(openPaywall).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Deshacer' })).not.toHaveProp(
        'accessibilityHint',
        'Requiere Premium'
      );
    });

    it('el Super Like también lo puede dar quien no es Premium', async () => {
      const onSuperLike = jest.fn();
      await render(<DeckActions onDecide={jest.fn()} onSuperLike={onSuperLike} />);

      await fireEvent.press(screen.getByRole('button', { name: 'Super Like' }));

      expect(onSuperLike).toHaveBeenCalledTimes(1);
      expect(openPaywall).not.toHaveBeenCalled();
    });

    it('deshabilitado, ni Deshacer ni Super Like ni Boost responden', async () => {
      const handlers = { onUndo: jest.fn(), onSuperLike: jest.fn(), onBoost: jest.fn() };
      await render(<DeckActions onDecide={jest.fn()} isPremium disabled {...handlers} />);

      for (const label of ['Super Like', 'Pasar', 'Like']) {
        expect(screen.getByRole('button', { name: label })).toBeDisabled();
      }
      await fireEvent.press(screen.getByRole('button', { name: 'Super Like' }));
      expect(handlers.onSuperLike).not.toHaveBeenCalled();
    });

    it.each([
      [5, 'Te quedan 5 likes'],
      [2, 'Te quedan 2 likes'],
      [1, 'Te queda 1 like'],
    ])('con %i likes restantes avisa: «%s»', async (likesLeft, text) => {
      await render(<DeckActions onDecide={jest.fn()} likesLeft={likesLeft} />);

      expect(screen.getByText(text)).toBeOnTheScreen();
    });

    it.each([6, 25, null, undefined])('con %s likes restantes no avisa', async (likesLeft) => {
      await render(<DeckActions onDecide={jest.fn()} likesLeft={likesLeft} />);

      expect(screen.queryByText(/Te quedan|Te queda/)).toBeNull();
    });

    it('con cero likes avisa, y con un número negativo (dato roto) no', async () => {
      const view = await render(<DeckActions onDecide={jest.fn()} likesLeft={0} />);
      expect(screen.getByText('Te quedan 0 likes')).toBeOnTheScreen();

      await view.rerender(<DeckActions onDecide={jest.fn()} likesLeft={-1} />);
      expect(screen.queryByText(/Te quedan/)).toBeNull();
    });

    it('deshabilitado, ni siquiera el candado de Deshacer abre el paywall', async () => {
      await render(<DeckActions onDecide={jest.fn()} disabled />);

      await fireEvent.press(screen.getByRole('button', { name: 'Deshacer' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Boost' }));

      expect(openPaywall).not.toHaveBeenCalled();
    });

    it('con Premium y sin manejadores, pulsar no rompe nada', async () => {
      await render(<DeckActions onDecide={jest.fn()} isPremium />);

      await fireEvent.press(screen.getByRole('button', { name: 'Deshacer' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Super Like' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Boost' }));

      expect(openPaywall).not.toHaveBeenCalled();
    });
  });
});
