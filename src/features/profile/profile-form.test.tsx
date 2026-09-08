/**
 * Tests del formulario de perfil.
 *
 * Es la puerta de entrada al producto: si valida mal, entran fichas
 * impresentables al deck; si normaliza mal, el perfil guardado no es el que la
 * persona rellenó. Los tests atacan esas dos cosas, no el aspecto.
 *
 * Se navega por `accessibilityLabel` a propósito: si un test deja de encontrar
 * un campo, es que ese campo ha dejado de ser accesible.
 *
 * Ojo: en React Native Testing Library 14 tanto `render` como `fireEvent` son
 * asíncronos. Sin `await` el árbol no llega a montarse y las queries fallan con
 * "`render` function has not been called".
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { buildProfile } from '@/data/test-fixtures';

import { ProfileForm } from './profile-form';

import type { ProfileInput } from '@/data';

/** Rellena el mínimo que `validate` exige para poder guardar. */
async function fillValidForm() {
  await fireEvent.changeText(screen.getByLabelText('Nombre'), 'Núria Bosch');
  await fireEvent.changeText(screen.getByLabelText('Edad'), '31');
  await fireEvent.changeText(screen.getByLabelText('Ubicación'), 'Barcelona');
  await fireEvent.press(screen.getByLabelText('Desarrollo'));
  await fireEvent.press(screen.getByLabelText('Cofundador'));
  await fireEvent.press(screen.getByLabelText('Idea sin empezar'));
  await fireEvent.press(screen.getByLabelText('Noche · 20–00'));
  await fireEvent.press(screen.getByLabelText('Apostarlo todo'));
  // La etiqueta del primer prompt la comparten su chip y su campo de texto, así
  // que aquí el campo se busca por el placeholder, que sí es único.
  await fireEvent.changeText(screen.getByPlaceholderText('Tu respuesta'), '  Un CRM.  ');
}

/**
 * Cada campo de texto y lo que el teclado debe hacer en él, buscado por
 * `placeholder` porque el de un prompt comparte etiqueta accesible con su chip.
 *
 * No es cosmética: el teclado de Android escribe en el `value` que se guarda en
 * Postgres. Un prompt que se capitaliza palabra por palabra llega a la ficha
 * como "Una Herramienta para Construir en equipo" cuando se escribió en
 * minúsculas. De ahí que ningún campo pueda quedarse sin declarar los dos
 * props: el defecto de la plataforma no es el que quiere este formulario.
 */
const KEYBOARD_BEHAVIOUR: { placeholder: string; autoCapitalize: string }[] = [
  // Un nombre propio se capitaliza por palabras, y el corrector no debe tocarlo.
  { placeholder: 'Cómo te llamas', autoCapitalize: 'words' },
  // Solo dígitos: no hay nada que capitalizar ni que corregir.
  { placeholder: '28', autoCapitalize: 'none' },
  // Topónimo: también nombre propio.
  { placeholder: 'Barcelona', autoCapitalize: 'words' },
  // Identificador IANA, sensible a mayúsculas y ajeno al diccionario.
  { placeholder: 'Europe/Madrid', autoCapitalize: 'none' },
  // Respuestas libres: prosa, no nombres propios. Solo la primera letra.
  { placeholder: 'Tu respuesta', autoCapitalize: 'sentences' },
  { placeholder: 'Opcional', autoCapitalize: 'sentences' },
  // URLs: cualquier retoque las rompe.
  { placeholder: 'https://github.com/tuusuario', autoCapitalize: 'none' },
  { placeholder: 'https://tuportfolio.com', autoCapitalize: 'none' },
  { placeholder: 'https://linkedin.com/in/tuusuario', autoCapitalize: 'none' },
];

const TEXT_FIELD_LABELS = [
  'Nombre',
  'Edad',
  'Ubicación',
  'Zona horaria',
  'GitHub',
  'Portfolio',
  'LinkedIn',
];

describe('ProfileForm', () => {
  it('pinta todos los campos de texto con etiqueta accesible', async () => {
    await render(<ProfileForm submitLabel="Guardar" onSubmit={jest.fn()} />);

    for (const label of TEXT_FIELD_LABELS) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it('todo control pulsable se anuncia con un nombre', async () => {
    await render(<ProfileForm submitLabel="Guardar" onSubmit={jest.fn()} onCancel={jest.fn()} />);

    const pressables = [
      ...screen.queryAllByRole('button'),
      ...screen.queryAllByRole('radio'),
      ...screen.queryAllByRole('checkbox'),
    ];

    // Un formulario con este número de opciones no puede quedarse sin controles:
    // si la query devolviera 0, el test pasaría sin comprobar nada.
    expect(pressables.length).toBeGreaterThan(20);
    for (const pressable of pressables) {
      expect(pressable).toHaveAccessibleName();
    }
  });

  it('no guarda un formulario vacío y explica qué falta', async () => {
    const onSubmit = jest.fn();
    await render(<ProfileForm submitLabel="Guardar" onSubmit={onSubmit} />);

    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('Escribe tu nombre.')).toBeTruthy();
    expect(screen.getByText('Elige al menos una especialidad.')).toBeTruthy();
    expect(screen.getByText('Dinos qué buscas.')).toBeTruthy();
    expect(screen.getByText('Marca al menos una franja horaria.')).toBeTruthy();
    expect(screen.getByText('Responde al menos a la primera pregunta.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rechaza una edad fuera de rango', async () => {
    await render(<ProfileForm submitLabel="Guardar" onSubmit={jest.fn()} />);

    await fireEvent.changeText(screen.getByLabelText('Edad'), '12');
    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('Una edad entre 16 y 99.')).toBeTruthy();
  });

  it('borra el error de un campo en cuanto se corrige', async () => {
    await render(<ProfileForm submitLabel="Guardar" onSubmit={jest.fn()} />);

    await fireEvent.press(screen.getByText('Guardar'));
    expect(await screen.findByText('Escribe tu nombre.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Nombre'), 'Marc');

    expect(screen.queryByText('Escribe tu nombre.')).toBeNull();
  });

  it('exige que los enlaces parezcan una URL', async () => {
    await render(<ProfileForm submitLabel="Guardar" onSubmit={jest.fn()} />);

    await fireEvent.changeText(screen.getByLabelText('GitHub'), 'github.com/nuria');
    await fireEvent.press(screen.getByText('Guardar'));

    expect(
      await screen.findByText('Los enlaces deben empezar por http:// o https://')
    ).toBeTruthy();
  });

  it('envía un ProfileInput normalizado cuando todo es válido', async () => {
    const onSubmit = jest.fn<Promise<void>, [ProfileInput]>().mockResolvedValue(undefined);
    await render(<ProfileForm submitLabel="Guardar" onSubmit={onSubmit} />);

    await fillValidForm();
    await fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const input = onSubmit.mock.calls[0][0];
    expect(input).toMatchObject({
      name: 'Núria Bosch',
      age: 31,
      location: 'Barcelona',
      specialties: ['dev'],
      lookingFor: 'par',
      startingPoint: 'idea-sin-empezar',
      ambition: 'todo-o-nada',
      availability: { hoursPerWeek: 10, bands: ['noche'] },
    });
    // Los espacios sobrantes se recortan y el prompt sin respuesta no viaja.
    expect(input.prompts).toEqual([{ question: 'Lo que quiero construir es…', answer: 'Un CRM.' }]);
    // Enlaces vacíos van como `undefined`, no como cadena vacía.
    expect(input.links).toEqual({ github: undefined, portfolio: undefined, linkedin: undefined });
  });

  it('el stepper de disponibilidad respeta el mínimo', async () => {
    const onSubmit = jest.fn<Promise<void>, [ProfileInput]>().mockResolvedValue(undefined);
    await render(<ProfileForm submitLabel="Guardar" onSubmit={onSubmit} />);

    await fillValidForm();
    // Arranca en 10 h y el mínimo es 2: doce restas no pueden bajar de ahí.
    for (let index = 0; index < 12; index += 1) {
      await fireEvent.press(screen.getByLabelText('Restar'));
    }
    await fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].availability.hoursPerWeek).toBe(2);
  });

  it('enseña el error si el guardado falla y no se queda colgado', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('Se cayó la red.'));
    await render(<ProfileForm submitLabel="Guardar" onSubmit={onSubmit} />);

    await fillValidForm();
    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('Se cayó la red.')).toBeTruthy();
    // El botón vuelve a su etiqueta normal: se puede reintentar.
    expect(screen.getByText('Guardar')).toBeTruthy();
  });

  describe('lo que debe dominar quien busco', () => {
    it('no se pregunta hasta saber qué busca la persona', async () => {
      await render(<ProfileForm submitLabel="Guardar" onSubmit={jest.fn()} />);

      expect(screen.queryByText('Lo que debe dominar quien busco')).toBeNull();
      expect(screen.queryByLabelText('Busco Desarrollo')).toBeNull();
    });

    it('no se pregunta a quien busca compañero de lock-in', async () => {
      await render(<ProfileForm submitLabel="Guardar" onSubmit={jest.fn()} />);

      await fireEvent.press(screen.getByLabelText('Compañero de Lock-In'));

      expect(screen.queryByText('Lo que debe dominar quien busco')).toBeNull();
    });

    it.each(['Cofundador', 'Ambos'])('se pregunta a quien elige "%s"', async (mode) => {
      await render(<ProfileForm submitLabel="Guardar" onSubmit={jest.fn()} />);

      await fireEvent.press(screen.getByLabelText(mode));

      expect(screen.getByText('Lo que debe dominar quien busco')).toBeTruthy();
      expect(screen.getByLabelText('Busco Desarrollo')).toBeTruthy();
    });

    it('distingue en accesibilidad lo que domino de lo que busco', async () => {
      await render(
        <ProfileForm defaultLookingFor="par" submitLabel="Guardar" onSubmit={jest.fn()} />
      );

      // Mismo texto visible en dos grupos: si compartieran nombre accesible,
      // quien navega a ciegas no podría saber cuál está marcando.
      await fireEvent.press(screen.getByLabelText('Busco Diseño'));

      expect(screen.getByLabelText('Busco Diseño')).toBeSelected();
      expect(screen.getByLabelText('Diseño')).not.toBeSelected();
    });

    it('envía las especialidades buscadas', async () => {
      const onSubmit = jest.fn<Promise<void>, [ProfileInput]>().mockResolvedValue(undefined);
      await render(<ProfileForm submitLabel="Guardar" onSubmit={onSubmit} />);

      await fillValidForm();
      await fireEvent.press(screen.getByLabelText('Busco Marketing'));
      await fireEvent.press(screen.getByLabelText('Busco Ventas'));
      await fireEvent.press(screen.getByText('Guardar'));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0][0].seekingSpecialties).toEqual(['marketing', 'ventas']);
    });

    it('deja el campo vacío si no se marca nada: abierto a cualquiera', async () => {
      const onSubmit = jest.fn<Promise<void>, [ProfileInput]>().mockResolvedValue(undefined);
      await render(<ProfileForm submitLabel="Guardar" onSubmit={onSubmit} />);

      await fillValidForm();
      await fireEvent.press(screen.getByText('Guardar'));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0][0].seekingSpecialties).toEqual([]);
    });

    it('lo vacía si al final se busca compañero de lock-in', async () => {
      const onSubmit = jest.fn<Promise<void>, [ProfileInput]>().mockResolvedValue(undefined);
      await render(<ProfileForm submitLabel="Guardar" onSubmit={onSubmit} />);

      await fillValidForm();
      await fireEvent.press(screen.getByLabelText('Busco Marketing'));
      // Cambiar de idea después de marcar chips no puede colar un perfil de
      // lock-in con especialidades buscadas: la invariante de `types.ts`.
      await fireEvent.press(screen.getByLabelText('Compañero de Lock-In'));
      await fireEvent.press(screen.getByText('Guardar'));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0][0]).toMatchObject({
        lookingFor: 'lockin',
        seekingSpecialties: [],
      });
    });

    it('precarga lo que ya buscaba al editar', async () => {
      const profile = buildProfile({ lookingFor: 'par', seekingSpecialties: ['diseno'] });
      await render(
        <ProfileForm initial={profile} submitLabel="Guardar cambios" onSubmit={jest.fn()} />
      );

      expect(screen.getByLabelText('Busco Diseño')).toBeSelected();
      expect(screen.getByLabelText('Busco Desarrollo')).not.toBeSelected();
    });
  });

  it('precarga los datos al editar un perfil existente', async () => {
    const profile = buildProfile({ name: 'Alba Ferrer', age: 27, location: 'Valencia' });
    await render(
      <ProfileForm initial={profile} submitLabel="Guardar cambios" onSubmit={jest.fn()} />
    );

    expect(screen.getByLabelText('Nombre').props.value).toBe('Alba Ferrer');
    expect(screen.getByLabelText('Edad').props.value).toBe('27');
    expect(screen.getByLabelText('Ubicación').props.value).toBe('Valencia');
  });

  it('precarga "qué busco" con el modo elegido en el onboarding', async () => {
    await render(
      <ProfileForm defaultLookingFor="lockin" submitLabel="Crear" onSubmit={jest.fn()} />
    );

    expect(screen.getByLabelText('Compañero de Lock-In')).toBeSelected();
    expect(screen.getByLabelText('Cofundador')).not.toBeSelected();
  });

  it('solo pinta el botón de cancelar cuando hay algo que cancelar', async () => {
    const onCancel = jest.fn();
    const { rerender } = await render(<ProfileForm submitLabel="Guardar" onSubmit={jest.fn()} />);
    expect(screen.queryByText('Cancelar')).toBeNull();

    await rerender(<ProfileForm submitLabel="Guardar" onSubmit={jest.fn()} onCancel={onCancel} />);
    await fireEvent.press(screen.getByText('Cancelar'));

    expect(onCancel).toHaveBeenCalled();
  });

  describe('zona horaria', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('precarga la que expone el dispositivo', async () => {
      jest.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
        resolvedOptions: () => ({ timeZone: 'America/Bogota' }),
      } as unknown as Intl.DateTimeFormat);

      await render(<ProfileForm submitLabel="Guardar" onSubmit={jest.fn()} />);

      expect(screen.getByLabelText('Zona horaria').props.value).toBe('America/Bogota');
    });

    it('cae a Europe/Madrid si el runtime no la expone', async () => {
      // Hermes sin ICU no trae `Intl`. Sin el respaldo, el alta arrancaría con
      // un campo obligatorio vacío y el formulario se negaría a guardar.
      jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
        throw new Error('Intl no disponible');
      });

      await render(<ProfileForm submitLabel="Guardar" onSubmit={jest.fn()} />);

      expect(screen.getByLabelText('Zona horaria').props.value).toBe('Europe/Madrid');
    });

    it('se puede corregir a mano y viaja recortada', async () => {
      const onSubmit = jest.fn<Promise<void>, [ProfileInput]>().mockResolvedValue(undefined);
      await render(<ProfileForm submitLabel="Guardar" onSubmit={onSubmit} />);

      await fillValidForm();
      await fireEvent.changeText(screen.getByLabelText('Zona horaria'), '  America/Bogota  ');
      await fireEvent.press(screen.getByText('Guardar'));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0][0].timezone).toBe('America/Bogota');
    });

    it('no guarda si se deja vacía', async () => {
      const onSubmit = jest.fn();
      await render(<ProfileForm submitLabel="Guardar" onSubmit={onSubmit} />);

      await fillValidForm();
      await fireEvent.changeText(screen.getByLabelText('Zona horaria'), '   ');
      await fireEvent.press(screen.getByText('Guardar'));

      expect(await screen.findByText('Necesitamos tu zona horaria.')).toBeTruthy();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it('guarda los tres enlaces recortados', async () => {
    const onSubmit = jest.fn<Promise<void>, [ProfileInput]>().mockResolvedValue(undefined);
    await render(<ProfileForm submitLabel="Guardar" onSubmit={onSubmit} />);

    await fillValidForm();
    await fireEvent.changeText(screen.getByLabelText('GitHub'), ' https://github.com/nuria ');
    await fireEvent.changeText(screen.getByLabelText('Portfolio'), 'https://nuria.dev');
    await fireEvent.changeText(screen.getByLabelText('LinkedIn'), 'https://linkedin.com/in/nuria');
    await fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].links).toEqual({
      github: 'https://github.com/nuria',
      portfolio: 'https://nuria.dev',
      linkedin: 'https://linkedin.com/in/nuria',
    });
  });

  it('cambia la pregunta de un prompt sin perder la respuesta ya escrita', async () => {
    const onSubmit = jest.fn<Promise<void>, [ProfileInput]>().mockResolvedValue(undefined);
    await render(<ProfileForm submitLabel="Guardar" onSubmit={onSubmit} />);

    await fillValidForm();
    // La misma pregunta aparece como chip en los dos prompts; el primero es el
    // que estamos rellenando.
    await fireEvent.press(screen.getAllByLabelText('Necesito compañía para…')[0]);
    await fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].prompts).toEqual([
      { question: 'Necesito compañía para…', answer: 'Un CRM.' },
    ]);
  });

  it('el stepper de disponibilidad respeta el máximo', async () => {
    const onSubmit = jest.fn<Promise<void>, [ProfileInput]>().mockResolvedValue(undefined);
    const profile = buildProfile({ availability: { hoursPerWeek: 58, bands: ['noche'] } });
    await render(<ProfileForm initial={profile} submitLabel="Guardar" onSubmit={onSubmit} />);

    // Arranca en 58 h y el máximo es 60: cinco sumas no pueden pasar de ahí.
    for (let index = 0; index < 5; index += 1) {
      await fireEvent.press(screen.getByLabelText('Sumar'));
    }
    await fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].availability.hoursPerWeek).toBe(60);
  });

  it('no queda ningún campo de texto sin declarar los dos props', async () => {
    await render(<ProfileForm submitLabel="Guardar" onSubmit={jest.fn()} />);

    // Se buscan por tipo, no por placeholder: así un campo nuevo que naciera sin
    // props (o sin placeholder) rompe este test en vez de colarse.
    const fields = screen.container.queryAll((node) => node.type === 'TextInput');

    expect(fields).toHaveLength(KEYBOARD_BEHAVIOUR.length);
    for (const field of fields) {
      expect(typeof field.props.autoCapitalize).toBe('string');
      expect(field.props.autoCorrect).toBe(false);
    }
  });

  it.each(KEYBOARD_BEHAVIOUR)(
    'el campo "$placeholder" declara autoCapitalize="$autoCapitalize" y desactiva el corrector',
    async ({ placeholder, autoCapitalize }) => {
      await render(<ProfileForm submitLabel="Guardar" onSubmit={jest.fn()} />);

      const field = screen.getByPlaceholderText(placeholder);

      expect(field.props.autoCapitalize).toBe(autoCapitalize);
      expect(field.props.autoCorrect).toBe(false);
    }
  );
});
