/**
 * Hoja para proponer una sesión: día, hora y bloques, con la franja común ya elegida.
 *
 * Reloj falso con hora local fija para que la preselección no dependa del momento.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { buildProfile } from '@/data/test-fixtures';

import { ProposeSessionSheet } from './propose-session-sheet';

const NOW = new Date(2026, 8, 14, 10, 7).getTime();
const me = buildProfile({
  id: 'me',
  timezone: 'Europe/Madrid',
  availability: { hoursPerWeek: 8, bands: ['noche'] },
});
const nuria = buildProfile({
  id: 'nuria',
  name: 'Núria Bosch',
  timezone: 'Europe/Madrid',
  availability: { hoursPerWeek: 8, bands: ['noche'] },
});

async function renderSheet(overrides: Partial<Parameters<typeof ProposeSessionSheet>[0]> = {}) {
  const onSubmit = jest.fn();
  const onClose = jest.fn();
  await render(
    <ProposeSessionSheet
      visible
      me={me}
      counterpart={nuria}
      nowMs={NOW}
      submitting={false}
      onSubmit={onSubmit}
      onClose={onClose}
      {...overrides}
    />
  );
  return { onSubmit, onClose };
}

describe('ProposeSessionSheet', () => {
  it('llega con la franja común de hoy y dos bloques elegidos', async () => {
    await renderSheet();

    expect(screen.getByLabelText('Día Hoy').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByLabelText('Hora 20:00').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByLabelText('2 bloques, hasta 21:00').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('propone la hora y los bloques elegidos', async () => {
    const { onSubmit } = await renderSheet();

    await fireEvent.press(screen.getByLabelText('4 bloques, hasta 22:00'));
    await fireEvent.press(screen.getByLabelText('Proponer sesión'));

    expect(onSubmit).toHaveBeenCalledWith(new Date(2026, 8, 14, 20, 0).toISOString(), 4);
  });

  it('cambiar de día conserva la hora si ese día la tiene', async () => {
    const { onSubmit } = await renderSheet();

    await fireEvent.press(screen.getByLabelText('Día Mañana'));
    await fireEvent.press(screen.getByLabelText('Proponer sesión'));

    expect(onSubmit).toHaveBeenCalledWith(new Date(2026, 8, 15, 20, 0).toISOString(), 2);
  });

  it('cerrar no propone nada', async () => {
    const { onSubmit, onClose } = await renderSheet();

    await fireEvent.press(screen.getByLabelText('Cerrar sin proponer'));

    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('mientras envía, el botón de proponer está deshabilitado', async () => {
    await renderSheet({ submitting: true });

    expect(screen.getByLabelText('Proponer sesión')).toBeDisabled();
  });
});

/**
 * La hoja reserva ella misma los insets que el sistema no le da: en Android el
 * `Modal` ocupa la pantalla entera con edge-to-edge y el título quedaba bajo el
 * reloj; en iOS `pageSheet` ya baja de la barra de estado y no debe sumarlo.
 */
describe('ProposeSessionSheet y los insets', () => {
  const INSETS = { top: 32, bottom: 24, left: 0, right: 0 };

  async function renderOn(os: 'android' | 'ios') {
    jest.replaceProperty(Platform, 'OS', os);
    await render(
      <SafeAreaInsetsContext.Provider value={INSETS}>
        <ProposeSessionSheet
          visible
          me={me}
          counterpart={nuria}
          nowMs={NOW}
          submitting={false}
          onSubmit={jest.fn()}
          onClose={jest.fn()}
        />
      </SafeAreaInsetsContext.Provider>
    );
    return StyleSheet.flatten(screen.getByTestId('propose-session-sheet').props.style);
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('en Android baja el contenido por debajo de la barra de estado', async () => {
    const style = await renderOn('android');

    expect(style.paddingTop).toBe(Spacing.four + INSETS.top);
    expect(style.paddingBottom).toBe(Spacing.four + INSETS.bottom);
  });

  it('en iOS no suma el inset de arriba: pageSheet ya deja el hueco', async () => {
    const style = await renderOn('ios');

    expect(style.paddingTop).toBe(Spacing.four);
    expect(style.paddingBottom).toBe(Spacing.four + INSETS.bottom);
  });
});
