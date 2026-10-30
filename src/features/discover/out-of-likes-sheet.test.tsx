/**
 * La hoja que sale cuando se agota un cupo (o hace falta Premium).
 *
 * Lo que no puede fallar: que la hora de «Sin likes hasta las HH:MM» salga de
 * `resetsAt`, que lo manda el servidor, y no de `Date.now()` del móvil (un
 * reloj adelantado o atrasado diría una hora que no es), y que la salida de
 * pago lleve al paywall sin cerrar la hoja a la fuerza.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { OutOfLikesSheet } from './out-of-likes-sheet';

/** «HH:MM» en la zona del dispositivo, que es la que enseña la hoja. */
function clock(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const RESETS_AT = '2026-10-27T18:30:00Z';

function setup(blocked: React.ComponentProps<typeof OutOfLikesSheet>['blocked']) {
  const onClose = jest.fn();
  const onUpgrade = jest.fn();
  return {
    onClose,
    onUpgrade,
    ui: <OutOfLikesSheet blocked={blocked} onClose={onClose} onUpgrade={onUpgrade} />,
  };
}

describe('OutOfLikesSheet', () => {
  it('cerrada no pinta nada', async () => {
    const { ui } = setup(null);
    await render(ui);

    expect(screen.queryByText(/Sin likes/)).toBeNull();
    expect(screen.queryByText('Hazte Premium')).toBeNull();
  });

  it('sin likes dice la hora del servidor, en la zona del dispositivo', async () => {
    const { ui } = setup({ kind: 'likes', resetsAt: RESETS_AT });
    await render(ui);

    expect(screen.getByText(`Sin likes hasta las ${clock(RESETS_AT)}`)).toBeOnTheScreen();
  });

  it('no mira el reloj del móvil: con otra hora local, la hoja dice la misma', async () => {
    jest.useFakeTimers({ now: new Date('2030-01-01T03:00:00Z') });
    try {
      const { ui } = setup({ kind: 'likes', resetsAt: RESETS_AT });
      await render(ui);

      expect(screen.getByText(`Sin likes hasta las ${clock(RESETS_AT)}`)).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  it('sin hora conocida no inventa una', async () => {
    const { ui } = setup({ kind: 'likes', resetsAt: null });
    await render(ui);

    expect(screen.getByText('Sin likes por ahora')).toBeOnTheScreen();
    expect(screen.queryByText(/hasta las/)).toBeNull();
  });

  it('«Hazte Premium» lleva al paywall y «Ahora no» cierra', async () => {
    const { ui, onClose, onUpgrade } = setup({ kind: 'likes', resetsAt: RESETS_AT });
    await render(ui);

    await fireEvent.press(screen.getByRole('button', { name: 'Hazte Premium' }));
    expect(onUpgrade).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Ahora no' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('el botón atrás de Android cierra la hoja', async () => {
    const { ui, onClose } = setup({ kind: 'likes', resetsAt: RESETS_AT });
    await render(ui);

    await fireEvent(screen.getByTestId('out-of-likes-modal'), 'requestClose');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('los Super Likes agotados lo dicen y también ofrecen Premium', async () => {
    const { ui } = setup({ kind: 'supers', resetsAt: RESETS_AT });
    await render(ui);

    expect(screen.getByText('Sin Super Likes por ahora')).toBeOnTheScreen();
    expect(screen.getByText('Hazte Premium')).toBeOnTheScreen();
  });

  it('el tope antiabuso no ofrece Premium: no lo arregla', async () => {
    const { ui } = setup({ kind: 'abuse', resetsAt: RESETS_AT });
    await render(ui);

    expect(screen.getByText('Demasiados likes por hoy')).toBeOnTheScreen();
    expect(screen.queryByText('Hazte Premium')).toBeNull();
    expect(screen.getByRole('button', { name: 'Entendido' })).toBeOnTheScreen();
  });

  it('cuando hace falta Premium, lo dice y ofrece el paywall', async () => {
    const { ui } = setup('premium');
    await render(ui);

    expect(screen.getByText('Esto es de Premium')).toBeOnTheScreen();
    expect(screen.getByText('Hazte Premium')).toBeOnTheScreen();
  });

  it('el Boost ya usado dice cuándo podrás otro y solo ofrece entender', async () => {
    const { ui } = setup({ kind: 'boost', resetsAt: RESETS_AT });
    await render(ui);

    expect(screen.getByText('Boost no disponible')).toBeOnTheScreen();
    expect(screen.getByText(/^Podrás usar otro el /)).toBeOnTheScreen();
    expect(screen.queryByText('Hazte Premium')).toBeNull();
  });

  it('el Boost ya usado sin fecha conocida no la inventa', async () => {
    const { ui } = setup({ kind: 'boost', resetsAt: null });
    await render(ui);

    expect(screen.getByText('Ya has usado tu Boost de este mes.')).toBeOnTheScreen();
  });

  it('los Super Likes con fecha la dicen, y sin fecha solo cuentan lo de Premium', async () => {
    const { ui } = setup({ kind: 'supers', resetsAt: RESETS_AT });
    const view = await render(ui);
    expect(screen.getByText(/^Tu próximo Super Like llega el /)).toBeOnTheScreen();

    await view.rerender(
      <OutOfLikesSheet
        blocked={{ kind: 'supers', resetsAt: null }}
        onClose={jest.fn()}
        onUpgrade={jest.fn()}
      />
    );
    expect(screen.getByText('Con Premium tienes 5 a la semana.')).toBeOnTheScreen();
  });

  it('una hora ilegible no se enseña: dice sin likes por ahora', async () => {
    const { ui } = setup({ kind: 'likes', resetsAt: 'mañana' });
    await render(ui);

    expect(screen.getByText('Sin likes por ahora')).toBeOnTheScreen();
  });

  it('quien ya es Premium no recibe una oferta que no le arregla nada', async () => {
    await render(
      <OutOfLikesSheet
        blocked={{ kind: 'supers', resetsAt: RESETS_AT }}
        isPremium
        onClose={jest.fn()}
        onUpgrade={jest.fn()}
      />
    );

    expect(screen.queryByText('Hazte Premium')).toBeNull();
    expect(screen.getByRole('button', { name: 'Entendido' })).toBeOnTheScreen();
  });
});
