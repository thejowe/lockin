/**
 * La fecha de nacimiento del alta: de ella sale la edad que guarda el perfil.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  BirthDateFields,
  ageFromBirthDate,
  birthDateProblem,
  joinBirthDate,
  splitBirthDate,
} from './birth-date';

describe('fecha de nacimiento', () => {
  const now = new Date(2026, 10, 1);

  it('saca la edad cumplida a día de hoy', () => {
    expect(ageFromBirthDate({ day: '1', month: '11', year: '1998' }, now)).toBe(28);
    expect(ageFromBirthDate({ day: '2', month: '11', year: '1998' }, now)).toBe(27);
  });

  it('rechaza fechas que no existen, futuras o fuera de rango', () => {
    expect(birthDateProblem({ day: '31', month: '2', year: '1998' }, now)).toMatch(/exista/);
    expect(birthDateProblem({ day: '1', month: '1', year: '2030' }, now)).toMatch(/exista/);
    expect(birthDateProblem({ day: '1', month: '1', year: '2020' }, now)).toMatch(/entre 16 y 99/);
    expect(birthDateProblem({ day: '1', month: '1', year: '1998' }, now)).toBeNull();
  });

  it('ida y vuelta con el borrador', () => {
    expect(joinBirthDate({ day: '5', month: '3', year: '1998' })).toBe('1998-03-05');
    expect(splitBirthDate('1998-03-05')).toEqual({ day: '5', month: '3', year: '1998' });
  });
});

describe('BirthDateFields', () => {
  it('cada campo acepta solo dígitos y avisa con el resto de la fecha intacto', async () => {
    const onChange = jest.fn();
    await render(
      <BirthDateFields
        value={{ day: '1', month: '2', year: '1990' }}
        onChange={onChange}
        error="Mal"
      />
    );

    await fireEvent.changeText(screen.getByLabelText('Día'), '1a5');
    await fireEvent.changeText(screen.getByLabelText('Mes'), 'x6');
    await fireEvent.changeText(screen.getByLabelText('Año'), '19y91');

    expect(onChange).toHaveBeenNthCalledWith(1, { day: '15', month: '2', year: '1990' });
    expect(onChange).toHaveBeenNthCalledWith(2, { day: '1', month: '6', year: '1990' });
    expect(onChange).toHaveBeenNthCalledWith(3, { day: '1', month: '2', year: '1991' });
    expect(screen.getByText('Mal')).toBeTruthy();
  });
});
