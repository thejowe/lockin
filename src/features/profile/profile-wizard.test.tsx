import { Control } from '@/constants/theme';
/**
 * El asistente del alta del perfil: una pregunta por pantalla, barra de
 * progreso, «Omitir» en lo opcional y la barra de las horas.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DataProvider } from '@/data';
import { createMockRepositories, resetState } from '@/data/mock';
import { setLocalePreference } from '@/i18n';

import { pickAvatarPhoto } from './avatar-photo';

import { ProfileWizard } from './profile-wizard';

jest.mock('./avatar-photo', () => ({ pickAvatarPhoto: jest.fn() }));

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
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Programación' }));
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
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Programación' }));
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
    await fireEvent(
      screen.getByRole('adjustable', { name: 'Fin de la jornada' }),
      'accessibilityAction',
      {
        nativeEvent: { actionName: 'decrement' },
      }
    );
    await fireEvent.press(screen.getByRole('button', { name: '+ Añadir otro tramo' }));
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
      availability: {
        hoursPerWeek: 10,
        ranges: [
          { startMin: 540, endMin: 810 },
          { startMin: 870, endMin: 930 },
        ],
        bands: ['manana', 'tarde'],
      },
    });
  });

  describe('con foto obligatoria', () => {
    let repositories: ReturnType<typeof createMockRepositories>;
    const onSubmit = jest.fn();
    const pick = jest.mocked(pickAvatarPhoto);

    beforeEach(() => {
      resetState();
      repositories = createMockRepositories();
      onSubmit.mockReset().mockResolvedValue(undefined);
      pick.mockReset();
    });

    async function toPhoto() {
      await render(
        <DataProvider value={repositories}>
          <ProfileWizard withPhoto seed={SEED} submitLabel="Continuar" onSubmit={onSubmit} />
        </DataProvider>
      );
      expect(screen.getByRole('progressbar', { name: 'Paso 1 de 13' })).toBeTruthy();
      await toHours();
      await next(); // horas
      await next(); // jornada
      await fireEvent.press(screen.getAllByRole('radio')[0]);
      await next();
      await skip(); // respuestas
      await skip(); // enlaces
    }

    const primary = () => screen.getByRole('button', { name: 'Continuar' });
    const openSheet = () => fireEvent.press(screen.getByRole('button', { name: 'Añadir foto' }));
    const gallery = () =>
      fireEvent.press(screen.getByRole('button', { name: 'Elegir de la galería' }));

    it('sin foto muestra la tarjeta y el consejo, y solo ofrece cámara y galería al tocarla', async () => {
      await toPhoto();
      expect(screen.getByText('Pon tu foto de perfil')).toBeTruthy();
      expect(screen.getByText('Que se te vea la cara y con buena luz')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Omitir' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Hacer una foto' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Elegir de la galería' })).toBeNull();
      expect(primary()).toBeDisabled();
      await fireEvent.press(primary());
      expect(onSubmit).not.toHaveBeenCalled();
      await openSheet();
      expect(screen.getByRole('button', { name: 'Hacer una foto' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Elegir de la galería' })).toBeEnabled();
      await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
      expect(pick).not.toHaveBeenCalled();
      expect(primary()).toBeDisabled();
    });

    it('muestra la vista previa en revisión y solo habilita continuar al aprobarse', async () => {
      pick.mockResolvedValue({ status: 'picked', uri: 'file:///f.jpg' });
      let approve!: () => void;
      const review = new Promise<void>((resolve) => {
        approve = resolve;
      });
      const publish = repositories.profiles.setAvatarPhoto;
      const upload = jest
        .spyOn(repositories.profiles, 'setAvatarPhoto')
        .mockImplementationOnce(async (uri) => {
          await review;
          return publish(uri);
        });
      await toPhoto();
      await openSheet();
      await gallery();
      expect(await screen.findByText('En revisión…')).toBeTruthy();
      expect(screen.getByTestId('wizard-photo')).toBeTruthy();
      expect(screen.getByText('Ana')).toBeTruthy();
      expect(screen.getByText('30')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Cambiar foto de perfil' })).toBeDisabled();
      expect(primary()).toBeDisabled();
      await fireEvent.press(primary());
      expect(onSubmit).not.toHaveBeenCalled();
      await act(async () => approve());
      expect(await screen.findByText('Foto aprobada')).toBeTruthy();
      expect(primary()).toBeEnabled();
      expect(onSubmit).not.toHaveBeenCalled();

      // Cancelar el cambio conserva la foto aprobada.
      await fireEvent.press(screen.getByRole('button', { name: 'Cambiar foto de perfil' }));
      pick.mockResolvedValueOnce({ status: 'cancelled' });
      await gallery();
      await fireEvent.press(primary());
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ana' }), null);
      expect(upload).toHaveBeenCalledTimes(1);
      expect((await repositories.profiles.getCurrent())?.avatar.imageUrl).toBe('file:///f.jpg');
    });

    it('reserva el sitio del estado y de la flecha para que la pantalla no salte en la revisión', async () => {
      pick.mockResolvedValue({ status: 'picked', uri: 'file:///f.jpg' });
      let approve!: () => void;
      const review = new Promise<void>((resolve) => {
        approve = resolve;
      });
      const publish = repositories.profiles.setAvatarPhoto;
      jest.spyOn(repositories.profiles, 'setAvatarPhoto').mockImplementationOnce(async (uri) => {
        await review;
        return publish(uri);
      });
      await toPhoto();
      // Antes de elegir: la línea del estado ya ocupa su sitio, vacía y oculta al lector.
      const status = () => screen.getByTestId('photo-status', { includeHiddenElements: true });
      expect(status()).toHaveTextContent(' ');
      expect(screen.queryByTestId('wizard-back-slot')).toBeNull();

      await openSheet();
      await gallery();
      expect(status()).toHaveTextContent('En revisión…');
      // Sin flecha mientras se revisa, pero su hueco mide lo mismo que ella.
      expect(screen.getByTestId('wizard-back-slot')).toHaveStyle({ height: Control.minTouch });

      await act(async () => approve());
      expect(status()).toHaveTextContent('Foto aprobada');
      expect(screen.queryByTestId('wizard-back-slot')).toBeNull();
    });

    it('el rechazo de un reemplazo bloquea continuar, explica el motivo y permite reintentar', async () => {
      pick.mockResolvedValue({ status: 'picked', uri: 'file:///foto.jpg' });
      await toPhoto();
      await openSheet();
      await gallery();
      expect(await screen.findByText('Foto aprobada')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Cambiar foto de perfil' }));

      const reason = 'Esta foto no cumple las normas de la comunidad. Prueba con otra.';
      jest.spyOn(repositories.profiles, 'setAvatarPhoto').mockRejectedValueOnce(new Error(reason));
      await gallery();
      expect(await screen.findByText(reason)).toBeTruthy();
      expect(screen.queryByTestId('wizard-photo')).toBeNull();
      expect(primary()).toBeDisabled();
      await fireEvent.press(primary());
      expect(onSubmit).not.toHaveBeenCalled();
      await openSheet();
      await gallery();
      expect(await screen.findByText('Foto aprobada')).toBeTruthy();
      expect(screen.queryByText(reason)).toBeNull();
      expect(primary()).toBeEnabled();
    });

    it('si el permiso se deniega lo explica y sigue sin dejar pasar', async () => {
      pick.mockResolvedValue({ status: 'denied' });
      await toPhoto();
      await openSheet();
      await fireEvent.press(screen.getByRole('button', { name: 'Hacer una foto' }));
      expect(await screen.findByText(/Sin permiso de cámara/)).toBeTruthy();
      expect(pick).toHaveBeenCalledWith('camera');
      expect(primary()).toBeDisabled();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it('el idioma es obligatorio; los que busco, opcionales', async () => {
    await render(<ProfileWizard seed={SEED} submitLabel="Crear perfil" onSubmit={jest.fn()} />);
    await toSpecialties();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Programación' }));
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
    await next(); // jornada
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

  it('sin «Sobre ti»: pide nombre y fecha, y guarda respuestas y enlaces escritos', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(<ProfileWizard submitLabel="Crear perfil" onSubmit={onSubmit} />);
    await next(); // idioma

    await fireEvent.changeText(screen.getByLabelText('Nombre'), 'Marta');
    await next();
    await fireEvent.changeText(screen.getByLabelText('Día'), '1x5');
    await fireEvent.changeText(screen.getByLabelText('Mes'), '6');
    await fireEvent.changeText(screen.getByLabelText('Año'), '1990');
    await next();

    await fireEvent.changeText(screen.getByLabelText('País'), 'esp');
    await fireEvent.press(screen.getByRole('button', { name: 'España' }));
    await fireEvent.changeText(screen.getByLabelText('Ciudad'), 'Vigo');
    await next();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Programación' }));
    await next();
    await skip(); // lo que busco
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Español' }));
    await next();
    await skip(); // idiomas que busco
    await fireEvent.press(screen.getAllByRole('radio')[0]);
    await next();
    await next(); // horas
    await next(); // jornada
    await fireEvent.press(screen.getAllByRole('radio')[0]);
    await next();

    // Respuestas: cambiar de pregunta y escribir.
    await fireEvent.press(screen.getAllByText('Necesito compañía para…')[0]);
    await fireEvent.changeText(screen.getByPlaceholderText('Tu respuesta'), 'Salir a correr');
    await next();

    await fireEvent.changeText(screen.getByLabelText('GitHub'), 'https://github.com/marta');
    await fireEvent.changeText(screen.getByLabelText('Portfolio'), 'https://marta.dev');
    await fireEvent.changeText(screen.getByLabelText('LinkedIn'), 'https://linkedin.com/in/marta');
    await fireEvent.changeText(screen.getByLabelText('Instagram'), 'https://instagram.com/marta');
    await fireEvent.changeText(screen.getByLabelText('TikTok'), 'https://tiktok.com/@marta');
    await fireEvent.press(screen.getByRole('button', { name: 'Crear perfil' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: 'Marta',
      links: { github: 'https://github.com/marta', tiktok: 'https://tiktok.com/@marta' },
      prompts: [{ question: 'Necesito compañía para…', answer: 'Salir a correr' }],
    });
  });

  it('una fecha que no existe no deja pasar del nacimiento', async () => {
    await render(<ProfileWizard submitLabel="Crear perfil" onSubmit={jest.fn()} />);
    await next();
    await fireEvent.changeText(screen.getByLabelText('Nombre'), 'Marta');
    await next();
    await fireEvent.changeText(screen.getByLabelText('Día'), '31');
    await fireEvent.changeText(screen.getByLabelText('Mes'), '2');
    await fireEvent.changeText(screen.getByLabelText('Año'), '1990');
    await next();

    expect(screen.getByText('Escribe una fecha que exista: día, mes y año.')).toBeTruthy();
    expect(screen.getByText('¿Cuándo naciste?')).toBeTruthy();
  });

  it('si el guardado falla se queda en el último paso y enseña el error', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('sin red'));
    await render(<ProfileWizard seed={SEED} submitLabel="Crear perfil" onSubmit={onSubmit} />);
    await toHours();
    await next();
    await next(); // jornada
    await fireEvent.press(screen.getAllByRole('radio')[0]);
    await next();
    await skip();
    await skip();

    expect(await screen.findByText('sin red')).toBeTruthy();
    expect(screen.getByText('¿Dónde te encuentran?')).toBeTruthy();
  });
});
