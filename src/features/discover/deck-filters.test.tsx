/**
 * Tests de los filtros del deck.
 *
 * La especialidad es libre; el resto (horas, franjas, ambición, punto de
 * partida y zona horaria) son de Premium: sin él se ven con candado y tocarlos
 * no cambia nada, solo avisa con `onLocked` para abrir el paywall.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { DeckFilters } from './deck-filters';

import type { ProfileFilter } from '@/data';

function setup(value: ProfileFilter = {}, isPremium = false) {
  const onChange = jest.fn();
  const onLocked = jest.fn();
  return {
    onChange,
    onLocked,
    ui: <DeckFilters value={value} isPremium={isPremium} onChange={onChange} onLocked={onLocked} />,
  };
}

describe('DeckFilters', () => {
  it('la especialidad se edita sin Premium', async () => {
    const { ui, onChange, onLocked } = setup();
    await render(ui);

    await fireEvent.press(screen.getByLabelText('Desarrollo'));

    expect(onChange).toHaveBeenCalledWith({ specialties: ['dev'] });
    expect(onLocked).not.toHaveBeenCalled();
  });

  it('quita una especialidad ya elegida y deja el filtro sin la clave', async () => {
    const { ui, onChange } = setup({ specialties: ['dev'] });
    await render(ui);

    await fireEvent.press(screen.getByLabelText('Desarrollo'));

    expect(onChange).toHaveBeenCalledWith({});
  });

  it.each([
    ['Horas mínimas por semana', 'Sumar horas mínimas'],
    ['Franjas', 'Mañana'],
    ['Ambición', 'Apostarlo todo'],
    ['Punto de partida', 'Idea sin empezar'],
    ['Zona horaria', 'Sumar diferencia horaria'],
  ])('sin Premium, «%s» tiene candado y avisa en vez de cambiar', async (section, control) => {
    const { ui, onChange, onLocked } = setup();
    await render(ui);

    expect(screen.getByText(section)).toBeTruthy();
    expect(screen.getAllByLabelText('Solo con Premium').length).toBeGreaterThanOrEqual(5);

    await fireEvent.press(screen.getByLabelText(control));

    expect(onLocked).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('con Premium no hay candado y los filtros avanzados cambian', async () => {
    const { ui, onChange, onLocked } = setup({}, true);
    await render(ui);

    expect(screen.queryByLabelText('Solo con Premium')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Apostarlo todo'));
    expect(onChange).toHaveBeenLastCalledWith({ ambition: ['todo-o-nada'] });

    await fireEvent.press(screen.getByLabelText('Mañana'));
    expect(onChange).toHaveBeenLastCalledWith({ timeBands: ['manana'] });

    await fireEvent.press(screen.getByLabelText('Sumar horas mínimas'));
    expect(onChange).toHaveBeenLastCalledWith({ minHoursPerWeek: 5 });

    await fireEvent.press(screen.getByLabelText('Sumar diferencia horaria'));
    expect(onChange).toHaveBeenLastCalledWith({ timezoneWindowHours: 0 });

    expect(onLocked).not.toHaveBeenCalled();
  });

  it('restar al mínimo quita el filtro de horas y la zona horaria acota en 12', async () => {
    const hours = setup({ minHoursPerWeek: 5 }, true);
    await render(hours.ui);
    await fireEvent.press(screen.getByLabelText('Restar horas mínimas'));
    expect(hours.onChange).toHaveBeenCalledWith({});
    await screen.unmount();

    const zone = setup({ timezoneWindowHours: 12 }, true);
    await render(zone.ui);
    expect(screen.getByLabelText('Sumar diferencia horaria').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true })
    );
  });

  it('«Limpiar» deja el filtro vacío, también con filtros premium puestos', async () => {
    const { ui, onChange } = setup({ specialties: ['dev'], ambition: ['todo-o-nada'] }, true);
    await render(ui);

    await fireEvent.press(screen.getByText('Limpiar'));

    expect(onChange).toHaveBeenCalledWith({});
  });

  it('«Limpiar» no se ofrece si no hay nada que limpiar', async () => {
    const { ui } = setup();
    await render(ui);

    expect(screen.queryByText('Limpiar')).toBeNull();
  });
});
