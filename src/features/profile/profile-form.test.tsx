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
});
