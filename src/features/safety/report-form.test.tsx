import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ReportForm } from './report-form';

describe('formulario de reporte', () => {
  it('exige un motivo de la lista cerrada; el texto es opcional', async () => {
    const onSubmit = jest.fn(async () => {});
    await render(
      <ReportForm name="Núria" onSubmit={onSubmit} onCancel={jest.fn()} onSubmitted={jest.fn()} />
    );
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Enviar reporte' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('radio', { name: 'Acoso' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar reporte' }));
    expect(onSubmit).toHaveBeenCalledWith('acoso', '');
  });

  it('limita los detalles a 500 caracteres y rechaza un valor demasiado largo', async () => {
    const onSubmit = jest.fn(async () => {});
    await render(
      <ReportForm name="Núria" onSubmit={onSubmit} onCancel={jest.fn()} onSubmitted={jest.fn()} />
    );
    const input = screen.getByLabelText('Detalles del reporte (opcional)');
    expect(input.props.maxLength).toBe(500);
    await fireEvent.press(screen.getByRole('radio', { name: 'Otro motivo' }));
    await fireEvent.changeText(input, 'x'.repeat(501));
    expect(screen.getByRole('button', { name: 'Enviar reporte' })).toBeDisabled();
    await fireEvent.changeText(input, 'x'.repeat(500));
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar reporte' }));
    expect(onSubmit).toHaveBeenCalledWith('otro', 'x'.repeat(500));
  });

  it('un error conserva motivo y texto para volver a enviarlo', async () => {
    const onSubmit = jest.fn().mockRejectedValueOnce(new Error('red')).mockResolvedValue(undefined);
    const onSubmitted = jest.fn();
    await render(
      <ReportForm name="Núria" onSubmit={onSubmit} onCancel={jest.fn()} onSubmitted={onSubmitted} />
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Acoso' }));
    await fireEvent.changeText(screen.getByLabelText('Detalles del reporte (opcional)'), 'Detalle');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar reporte' }));
    expect(screen.getByText('No se ha podido enviar el reporte. Inténtalo otra vez.')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Acoso' }).props.accessibilityState.checked).toBe(
      true
    );
    expect(screen.getByLabelText('Detalles del reporte (opcional)').props.value).toBe('Detalle');
    expect(onSubmitted).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar reporte' }));
    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });

  describe('acciones ancladas (tarjeta del deck, sobre la barra de tabs)', () => {
    it('«Enviar reporte» y «Cancelar» quedan fuera del scroll y los campos dentro', async () => {
      await render(
        <ReportForm
          name="Núria"
          anchorActions
          onSubmit={jest.fn(async () => {})}
          onCancel={jest.fn()}
          onSubmitted={jest.fn()}
        />
      );
      const scroll = within(screen.getByTestId('report-fields'));
      expect(scroll.getAllByRole('radio')).toHaveLength(5);
      expect(scroll.queryByRole('button', { name: 'Enviar reporte' })).toBeNull();
      expect(scroll.queryByRole('button', { name: 'Cancelar reporte' })).toBeNull();

      const actions = within(screen.getByTestId('report-actions'));
      expect(actions.getByRole('button', { name: 'Enviar reporte' })).toBeTruthy();
      expect(actions.getByRole('button', { name: 'Cancelar reporte' })).toBeTruthy();
    });

    it('el formulario anclado sigue enviando el reporte', async () => {
      const onSubmit = jest.fn(async () => {});
      await render(
        <ReportForm
          name="Núria"
          anchorActions
          onSubmit={onSubmit}
          onCancel={jest.fn()}
          onSubmitted={jest.fn()}
        />
      );
      await fireEvent.press(screen.getByRole('radio', { name: 'Spam o estafa' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Enviar reporte' }));
      expect(onSubmit).toHaveBeenCalledWith('spam', '');
    });

    describe('con el teclado abierto', () => {
      const keyboard = jest.requireMock('react-native-keyboard-controller') as {
        useKeyboardState: jest.Mock;
      };
      const previousState = keyboard.useKeyboardState.getMockImplementation();

      afterEach(() => {
        keyboard.useKeyboardState.mockImplementation(previousState);
      });

      function openKeyboard(isVisible: boolean) {
        keyboard.useKeyboardState.mockImplementation(
          (selector?: (state: { isVisible: boolean; height: number }) => unknown) => {
            const state = { isVisible, height: 336 };
            return selector ? selector(state) : state;
          }
        );
      }

      async function renderAnchored() {
        await render(
          <ReportForm
            name="Núria"
            anchorActions
            onSubmit={jest.fn(async () => {})}
            onCancel={jest.fn()}
            onSubmitted={jest.fn()}
          />
        );
        return screen.getByTestId('report-anchored');
      }

      it('reserva el teclado al pie para que las acciones queden sobre él', async () => {
        openKeyboard(true);
        const root = await renderAnchored();
        // Sin medida del borde (no hay nativo en Jest) se reserva el teclado entero.
        expect(StyleSheet.flatten(root.props.style).paddingBottom).toBe(336);
        // Las acciones siguen fuera del scroll, accesibles y pulsables.
        const actions = within(screen.getByTestId('report-actions'));
        expect(actions.getByRole('button', { name: 'Enviar reporte' })).toBeTruthy();
        expect(actions.getByRole('button', { name: 'Cancelar reporte' })).toBeTruthy();
      });

      it('con el teclado cerrado no cambia nada', async () => {
        openKeyboard(false);
        const root = await renderAnchored();
        expect(StyleSheet.flatten(root.props.style).paddingBottom).toBe(0);
      });
    });

    it('sin anclar no añade ningún scroll propio (el padre ya lo pone)', async () => {
      await render(
        <ReportForm
          name="Núria"
          onSubmit={jest.fn(async () => {})}
          onCancel={jest.fn()}
          onSubmitted={jest.fn()}
        />
      );
      expect(screen.queryByTestId('report-fields')).toBeNull();
      expect(screen.queryByTestId('report-actions')).toBeNull();
    });
  });
});
