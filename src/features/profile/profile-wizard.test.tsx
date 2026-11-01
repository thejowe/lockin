/**
 * El asistente del alta del perfil: una pregunta por pantalla, barra de
 * progreso, «Omitir» en lo opcional y la barra de las horas.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ProfileWizard } from './profile-wizard';

const SEED = { name: 'Ana', age: 30, location: 'Vigo' };

async function next() {
  await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
}

async function skip() {
  await fireEvent.press(screen.getByRole('button', { name: 'Omitir' }));
}

/** Avanza hasta el paso de las horas con lo mínimo obligatorio. */
async function toHours() {
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Desarrollo' }));
  await next();
  await skip(); // lo que busco
  await fireEvent.press(screen.getAllByRole('radio')[0]);
  await next();
}

describe('ProfileWizard', () => {
  it('con «Sobre ti» ya contestado empieza por lo que domino, con la barra a cero pasos de más', async () => {
    await render(<ProfileWizard seed={SEED} submitLabel="Crear perfil" onSubmit={jest.fn()} />);

    expect(screen.getByText('¿Qué dominas?')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Paso 1 de 8' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Omitir' })).toBeNull();
  });

  it('sin «Sobre ti» pregunta antes nombre, fecha de nacimiento y ubicación', async () => {
    await render(<ProfileWizard submitLabel="Crear perfil" onSubmit={jest.fn()} />);

    expect(screen.getByText('¿Cómo te llamas?')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Paso 1 de 11' })).toBeTruthy();
  });

  it('no deja pasar un paso obligatorio vacío y lo dice', async () => {
    await render(<ProfileWizard seed={SEED} submitLabel="Crear perfil" onSubmit={jest.fn()} />);

    await next();

    expect(screen.getByText('Elige al menos una especialidad.')).toBeTruthy();
    expect(screen.getByText('¿Qué dominas?')).toBeTruthy();
  });

  it('lo que busco es opcional: «Omitir» sigue y la flecha vuelve', async () => {
    await render(<ProfileWizard seed={SEED} submitLabel="Crear perfil" onSubmit={jest.fn()} />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Desarrollo' }));
    await next();

    expect(screen.getByText('¿Qué le pides a tu cofundador?')).toBeTruthy();
    await skip();
    expect(screen.getByText('¿En qué punto estás?')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByText('¿Qué le pides a tu cofundador?')).toBeTruthy();
  });

  it('las horas se mueven con la barra, de una en una', async () => {
    await render(<ProfileWizard seed={SEED} submitLabel="Crear perfil" onSubmit={jest.fn()} />);
    await toHours();

    const slider = screen.getByRole('adjustable', { name: 'Horas por semana' });
    expect(screen.getByText('10')).toBeTruthy();

    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(screen.getByText('11')).toBeTruthy();

    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(screen.getByText('9')).toBeTruthy();
  });

  it('recorre todos los pasos, omite los opcionales y entrega un perfil válido', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(<ProfileWizard seed={SEED} submitLabel="Crear perfil" onSubmit={onSubmit} />);
    await toHours();
    await next(); // horas
    await fireEvent.press(screen.getAllByRole('checkbox')[0]); // una franja
    await next();
    await fireEvent.press(screen.getAllByRole('radio')[0]); // ambición
    await next();
    await skip(); // respuestas
    expect(screen.getByRole('progressbar', { name: 'Paso 8 de 8' })).toBeTruthy();
    await skip(); // enlaces: es el último, omitir termina

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: 'Ana',
      age: 30,
      location: 'Vigo',
      specialties: ['dev'],
      seekingSpecialties: [],
      prompts: [],
      availability: { hoursPerWeek: 10 },
    });
  });

  it('si el guardado falla se queda en el último paso y enseña el error', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('sin red'));
    await render(<ProfileWizard seed={SEED} submitLabel="Crear perfil" onSubmit={onSubmit} />);
    await toHours();
    await next();
    await fireEvent.press(screen.getAllByRole('checkbox')[0]);
    await next();
    await fireEvent.press(screen.getAllByRole('radio')[0]);
    await next();
    await skip();
    await skip();

    expect(await screen.findByText('sin red')).toBeTruthy();
    expect(screen.getByText('¿Dónde te encuentran?')).toBeTruthy();
  });
});
