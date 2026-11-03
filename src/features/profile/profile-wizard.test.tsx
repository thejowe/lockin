/**
 * El asistente del alta del perfil: una pregunta por pantalla, barra de
 * progreso, «Omitir» en lo opcional y la barra de las horas.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { setLocalePreference } from '@/i18n';

import { ProfileWizard } from './profile-wizard';

const SEED = { name: 'Ana', age: 30 };

async function next() {
  await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
}

async function skip() {
  await fireEvent.press(screen.getByRole('button', { name: 'Omitir' }));
}

/** Pasa el idioma (se queda el que hay) y la ubicación: España, Vigo. */
async function toSpecialties() {
  await next(); // idioma
  await fireEvent.changeText(screen.getByLabelText('País'), 'esp');
  await fireEvent.press(screen.getByRole('button', { name: 'España' }));
  await fireEvent.changeText(screen.getByLabelText('Ciudad'), 'Vigo');
  await next();
}

/** Avanza hasta el paso de las horas con lo mínimo obligatorio. */
async function toHours() {
  await toSpecialties();
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Desarrollo' }));
  await next();
  await skip(); // lo que busco
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Español' }));
  await next();
  await skip(); // idiomas que busco
  await fireEvent.press(screen.getAllByRole('radio')[0]);
  await next();
}

describe('ProfileWizard', () => {
  afterEach(async () => {
    await setLocalePreference('auto');
  });

  it('lo primero es el idioma de la app, sin «Omitir»', async () => {
    await render(<ProfileWizard seed={SEED} submitLabel="Crear perfil" onSubmit={jest.fn()} />);

    expect(screen.getByText('¿En qué idioma quieres usar la app?')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Paso 1 de 12' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Español' })).toBeSelected();
    expect(screen.getByRole('radio', { name: 'English' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Català' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Omitir' })).toBeNull();
  });

  it('con «Sobre ti» ya contestado pasa del idioma a la ubicación y luego a lo que domino', async () => {
    await render(<ProfileWizard seed={SEED} submitLabel="Crear perfil" onSubmit={jest.fn()} />);
    await next();
    expect(screen.getByText('¿Dónde vives?')).toBeTruthy();

    await next();
    expect(screen.getByText('Elige tu país de la lista.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('País'), 'esp');
    await fireEvent.press(screen.getByRole('button', { name: 'España' }));
    await next();
    expect(screen.getByText('Escribe tu ciudad.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Ciudad'), 'Vigo');
    await next();
    expect(screen.getByText('¿Qué dominas?')).toBeTruthy();
  });

  it('sin «Sobre ti» pregunta, tras el idioma, nombre, fecha de nacimiento y ubicación', async () => {
    await render(<ProfileWizard submitLabel="Crear perfil" onSubmit={jest.fn()} />);
    expect(screen.getByRole('progressbar', { name: 'Paso 1 de 14' })).toBeTruthy();

    await next();
    expect(screen.getByText('¿Cómo te llamas?')).toBeTruthy();
  });

  it('cambiar de idioma no pierde lo rellenado aunque el asistente se vuelva a montar', async () => {
    await render(<ProfileWizard seed={SEED} submitLabel="Crear perfil" onSubmit={jest.fn()} />);
    await toSpecialties();
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));

    await fireEvent.press(screen.getByRole('radio', { name: 'English' }));
    // Lo que hace `_layout.tsx` al cambiar de idioma.
    await screen.rerender(
      <ProfileWizard key="remontado" seed={SEED} submitLabel="Crear perfil" onSubmit={jest.fn()} />
    );

    expect(screen.getByText('Which language do you want to use the app in?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect((await screen.findByLabelText('Country')).props.value).toBe('Spain');
    expect(screen.getByLabelText('City').props.value).toBe('Vigo');
  });

  it('un país con varias zonas deja elegir la suya', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(<ProfileWizard seed={SEED} submitLabel="Crear perfil" onSubmit={onSubmit} />);
    await next();
    await fireEvent.changeText(screen.getByLabelText('País'), 'unidos');
    await fireEvent.press(screen.getByRole('button', { name: 'Estados Unidos' }));
    await fireEvent.changeText(screen.getByLabelText('Ciudad'), 'Chicago');
    await fireEvent.press(screen.getByRole('radio', { name: 'Chicago' }));
    await next();

    expect(screen.getByText('¿Qué dominas?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByRole('radio', { name: 'Chicago' })).toBeSelected();
  });

  it('no deja pasar un paso obligatorio vacío y lo dice', async () => {
    await render(<ProfileWizard seed={SEED} submitLabel="Crear perfil" onSubmit={jest.fn()} />);

    await toSpecialties();
    await next();

    expect(screen.getByText('Elige al menos una especialidad.')).toBeTruthy();
    expect(screen.getByText('¿Qué dominas?')).toBeTruthy();
  });

  it('lo que busco es opcional: «Omitir» sigue y la flecha vuelve', async () => {
    await render(<ProfileWizard seed={SEED} submitLabel="Crear perfil" onSubmit={jest.fn()} />);
    await toSpecialties();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Desarrollo' }));
    await next();

    expect(screen.getByText('¿Qué le pides a tu cofundador?')).toBeTruthy();
    await skip();
    expect(screen.getByText('¿Qué idiomas hablas?')).toBeTruthy();

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
    expect(screen.getByRole('progressbar', { name: 'Paso 12 de 12' })).toBeTruthy();
    await skip(); // enlaces: es el último, omitir termina

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: 'Ana',
      age: 30,
      location: 'Vigo, España',
      timezone: 'Europe/Madrid',
      specialties: ['dev'],
      seekingSpecialties: [],
      otherSpecialty: null,
      languages: ['es'],
      seekingLanguages: [],
      prompts: [],
      availability: { hoursPerWeek: 10 },
    });
  });

  it('el idioma es obligatorio; los que busco, opcionales', async () => {
    await render(<ProfileWizard seed={SEED} submitLabel="Crear perfil" onSubmit={jest.fn()} />);
    await toSpecialties();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Desarrollo' }));
    await next();
    await skip();

    await next();
    expect(screen.getByText('Elige al menos un idioma.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Inglés' }));
    await next();
    expect(screen.getByText('¿Qué idiomas debe hablar?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Omitir' })).toBeTruthy();
  });

  it('«Otra» abre un campo para escribirla y vale sin marcar ninguna de la lista', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(<ProfileWizard seed={SEED} submitLabel="Crear perfil" onSubmit={onSubmit} />);
    await toSpecialties();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Otra' }));

    await next();
    expect(screen.getByText('Escribe cuál es la otra, o desmárcala.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Otra especialidad'), '  Biotecnología ');
    await next();
    expect(screen.getByText('¿Qué le pides a tu cofundador?')).toBeTruthy();
    // Lo que busco no tiene «Otra».
    expect(screen.queryByRole('checkbox', { name: 'Otra' })).toBeNull();

    await skip();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Español' }));
    await next();
    await skip();
    await fireEvent.press(screen.getAllByRole('radio')[0]);
    await next();
    await next(); // horas
    await fireEvent.press(screen.getAllByRole('checkbox')[0]);
    await next();
    await fireEvent.press(screen.getAllByRole('radio')[0]);
    await next();
    await skip();
    await skip();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      specialties: [],
      otherSpecialty: 'Biotecnología',
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
