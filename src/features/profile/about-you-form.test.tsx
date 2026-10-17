/**
 * «Sobre ti», el primer paso del alta, y el borrador que lleva sus datos hasta
 * el formulario de perfil.
 *
 * Lo que importa: que lo que pasa aquí no lo rechace después el formulario
 * largo (mismas reglas), que se entregue limpio, y que el borrador sobreviva y
 * se pueda borrar.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { AboutYouForm, validateBasics } from './about-you-form';
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

describe('AboutYouForm', () => {
  it('entrega nombre, edad y ubicación sin espacios de más', async () => {
    const onNext = jest.fn();
    await render(<AboutYouForm step="Paso 1 de 4" onNext={onNext} />);

    expect(screen.getByText('Paso 1 de 4')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Nombre'), '  Ana ');
    await fireEvent.changeText(screen.getByLabelText('Edad'), '2a8');
    await fireEvent.changeText(screen.getByLabelText('De dónde eres'), ' Bilbao ');
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));

    await waitFor(() =>
      expect(onNext).toHaveBeenCalledWith({ name: 'Ana', age: 28, location: 'Bilbao' })
    );
  });

  it('con un campo mal no sigue y dice cuál', async () => {
    const onNext = jest.fn();
    await render(<AboutYouForm onNext={onNext} />);

    await fireEvent.changeText(screen.getByLabelText('Nombre'), 'Ana');
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByText(/Una edad entre/)).toBeTruthy();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('arranca con lo que ya se tecleó', async () => {
    await render(
      <AboutYouForm initial={{ name: 'Ana', age: 30, location: 'Vigo' }} onNext={jest.fn()} />
    );

    expect(screen.getByDisplayValue('Ana')).toBeTruthy();
    expect(screen.getByDisplayValue('30')).toBeTruthy();
    expect(screen.getByDisplayValue('Vigo')).toBeTruthy();
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
