/**
 * Tests del hueco de "Agendar sesión Lock-In".
 *
 * Esta pieza promete algo que el MVP no hace, y la única defensa contra que se
 * lea como una funcionalidad rota es que lo diga: la insignia pone "Pronto" y
 * la pista de accesibilidad avisa antes de pulsar. Se prueban esas dos, más el
 * plegado (que es toda su lógica) y que la nota nombre a la otra persona: sin
 * eso, el consejo de "acordadlo por aquí" no se dirige a nadie.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { LockInCta } from './lock-in-cta';

const TRIGGER = 'Agendar sesión Lock-In';

describe('LockInCta', () => {
  it('arranca plegado y anuncia que todavía no está disponible', async () => {
    await render(<LockInCta counterpartName="Núria" />);

    const trigger = screen.getByLabelText(TRIGGER);
    expect(trigger.props.accessibilityState).toMatchObject({ expanded: false });
    expect(trigger.props.accessibilityHint).toBe(
      'Todavía no disponible. Ábrelo para saber en qué consistirá.'
    );
    expect(screen.getByText('Pronto')).toBeTruthy();
    expect(screen.queryByText(/Sentaros a trabajar a la vez/)).toBeNull();
  });

  it('al abrirlo explica qué será en vez de fingir que agenda', async () => {
    await render(<LockInCta counterpartName="Núria" />);

    await fireEvent.press(screen.getByLabelText(TRIGGER));

    expect(screen.getByText(/Todavía no está construido/)).toBeTruthy();
    expect(screen.getByLabelText(TRIGGER).props.accessibilityState).toMatchObject({
      expanded: true,
    });
    expect(screen.getByText('Cerrar')).toBeTruthy();
    expect(screen.queryByText('Pronto')).toBeNull();
  });

  it('la nota nombra a la otra persona: el consejo va dirigido a alguien', async () => {
    await render(<LockInCta counterpartName="Núria" />);

    await fireEvent.press(screen.getByLabelText(TRIGGER));

    expect(screen.getByText(/acordadlo por aquí con Núria/)).toBeTruthy();
  });

  it('vuelve a plegarse al pulsarlo otra vez', async () => {
    await render(<LockInCta counterpartName="Núria" />);

    await fireEvent.press(screen.getByLabelText(TRIGGER));
    await fireEvent.press(screen.getByLabelText(TRIGGER));

    expect(screen.queryByText(/Todavía no está construido/)).toBeNull();
    expect(screen.getByText('Pronto')).toBeTruthy();
  });
});
