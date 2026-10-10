import { fireEvent, render, screen, within } from '@testing-library/react-native';

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
