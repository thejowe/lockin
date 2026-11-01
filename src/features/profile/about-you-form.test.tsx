/**
 * «Sobre ti», el primer paso del alta, y el borrador que lleva sus datos hasta
 * el formulario de perfil.
 *
 * Lo que importa: que lo que pasa aquí no lo rechace después el formulario
 * largo (mismas reglas), que se entregue limpio, y que el borrador sobreviva y
 * se pueda borrar.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import {
  AboutYouForm,
  ageFromBirthDate,
  birthDateProblem,
  joinBirthDate,
  splitBirthDate,
  validateBasics,
} from './about-you-form';
import { clearSignupBasics, readSignupBasics, saveSignupBasics } from './signup-draft';

describe('validateBasics', () => {
  it('acepta un nombre, una edad dentro de rango y una ciudad', () => {
    expect(validateBasics({ name: 'Ana', age: '28', location: 'Bilbao' })).toEqual({});
  });

  it('marca cada campo que falla', () => {
    const errors = validateBasics({ name: 'A', age: '12', location: '' });
    expect(errors.name).toBeTruthy();
    expect(errors.age).toMatch(/entre 16 y 99/);
    expect(errors.location).toBeTruthy();
  });
});

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

describe('AboutYouForm', () => {
  async function fill(label: string, value: string) {
    await fireEvent.changeText(screen.getByLabelText(label), value);
  }
  async function next() {
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
  }

  it('pregunta de uno en uno y entrega todo limpio al final', async () => {
    const onNext = jest.fn();
    await render(<AboutYouForm onNext={onNext} />);

    expect(screen.getByRole('progressbar', { name: 'Paso 1 de 3' })).toBeTruthy();
    await fill('Nombre', '  Ana ');
    await next();

    expect(screen.getByText('¿Cuándo naciste?')).toBeTruthy();
    await fill('Día', '1');
    await fill('Mes', '2');
    await fill('Año', '1990');
    await next();

    expect(screen.getByText('¿Dónde vives?')).toBeTruthy();
    await fill('De dónde eres', ' Bilbao ');
    await next();

    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
    expect(onNext).toHaveBeenCalledWith({
      name: 'Ana',
      age: ageFromBirthDate({ day: '1', month: '2', year: '1990' }),
      location: 'Bilbao',
      birthDate: '1990-02-01',
    });
  });

  it('con un paso mal no avanza y dice qué falla', async () => {
    await render(<AboutYouForm onNext={jest.fn()} />);

    await next();

    expect(screen.getByText('Escribe tu nombre.')).toBeTruthy();
    expect(screen.queryByText('¿Cuándo naciste?')).toBeNull();
  });

  it('la flecha vuelve al paso anterior conservando lo tecleado', async () => {
    await render(<AboutYouForm onNext={jest.fn()} />);
    await fill('Nombre', 'Ana');
    await next();

    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));

    expect(screen.getByDisplayValue('Ana')).toBeTruthy();
  });

  it('arranca con lo que ya se tecleó', async () => {
    await render(
      <AboutYouForm
        initial={{ name: 'Ana', age: 30, location: 'Vigo', birthDate: '1996-03-05' }}
        onNext={jest.fn()}
      />
    );
    expect(screen.getByDisplayValue('Ana')).toBeTruthy();

    await next();
    expect(screen.getByDisplayValue('1996')).toBeTruthy();
  });
});

describe('signup-draft', () => {
  beforeEach(() => clearSignupBasics());

  it('guarda, lee y borra el borrador', async () => {
    expect(await readSignupBasics()).toBeNull();

    await saveSignupBasics({ name: 'Ana', age: 30, location: 'Vigo' });
    expect(await readSignupBasics()).toEqual({ name: 'Ana', age: 30, location: 'Vigo' });

    await clearSignupBasics();
    expect(await readSignupBasics()).toBeNull();
  });
});
