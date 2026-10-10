import { fireEvent, render, screen } from '@testing-library/react-native';

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
});
