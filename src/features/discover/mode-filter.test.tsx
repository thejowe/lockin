/**
 * Tests del filtro de modo del deck.
 *
 * Tiene poca lógica y toda es de accesibilidad: son tres radios de un mismo
 * grupo, y lo que se puede romper en silencio es que dos queden marcados a la
 * vez, que la etiqueta corta que se ve ("Cofundador") tape el nombre completo
 * que se anuncia, o que pulsar el modo ya activo no avise a la pantalla.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { ModeFilter } from './mode-filter';

import type { ModePreference } from '@/data';

/** Monta el filtro con un espía por `onChange` y el modo que pidas. */
function setup(value: ModePreference = 'ambos') {
  const onChange = jest.fn();
  return { onChange, ui: <ModeFilter value={value} onChange={onChange} /> };
}

describe('ModeFilter', () => {
  it('es un grupo de radios con una opción por modo', async () => {
    const { ui } = setup();
    await render(ui);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);

    // El contenedor lleva `accessibilityRole="radiogroup"` pero no es un
    // elemento accesible en sí, así que `getByRole` no lo alcanza: se comprueba
    // desde los radios, que sí cuelgan de él.
    expect(radios[0].parent?.props.accessibilityRole).toBe('radiogroup');
  });

  it('muestra etiquetas cortas pero anuncia el nombre completo del modo', async () => {
    const { ui } = setup();
    await render(ui);

    // Lo que cabe en la fila…
    expect(screen.getByText('Todo')).toBeTruthy();
    expect(screen.getByText('Cofundador')).toBeTruthy();
    expect(screen.getByText('Lock-In')).toBeTruthy();

    // …y lo que se lee en voz alta, que sí es explícito.
    expect(screen.getByLabelText('Compañero de Lock-In')).toBeTruthy();
    expect(screen.getByLabelText('Cofundador')).toBeTruthy();
    expect(screen.getByLabelText('Ambos')).toBeTruthy();
  });

  it.each([
    ['ambos', 'Ambos'],
    ['par', 'Cofundador'],
    ['lockin', 'Compañero de Lock-In'],
  ] as const)('marca como seleccionado solo el modo %s', async (mode, label) => {
    const { ui } = setup(mode);
    await render(ui);

    expect(screen.getByLabelText(label)).toBeSelected();

    const selected = screen
      .getAllByRole('radio')
      .filter((radio) => radio.props.accessibilityState?.selected);
    expect(selected).toHaveLength(1);
  });

  it('avisa con el modo elegido al pulsar otro chip', async () => {
    const { onChange, ui } = setup('ambos');
    await render(ui);

    await fireEvent.press(screen.getByLabelText('Compañero de Lock-In'));

    expect(onChange).toHaveBeenCalledWith('lockin');
  });

  it('también avisa al pulsar el modo ya activo: la pantalla decide qué hacer', async () => {
    const { onChange, ui } = setup('par');
    await render(ui);

    await fireEvent.press(screen.getByLabelText('Cofundador'));

    expect(onChange).toHaveBeenCalledWith('par');
  });

  it('deja alcanzable el chip de 32 px con hitSlop vertical', async () => {
    const { ui } = setup();
    await render(ui);

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.props.hitSlop).toEqual({ top: 6, bottom: 6 });
    }
  });
});
