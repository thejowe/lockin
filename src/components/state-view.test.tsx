/**
 * Estados de pantalla completa: la carga dice qué se carga (nunca en blanco) y
 * el mensaje pinta solo las piezas que recibe, con las acciones debajo.
 */

import { render, screen } from '@testing-library/react-native';

import { Button } from '@/components/button';
import { LoadingState, MessageState } from '@/components/state-view';
import { Colors } from '@/constants/theme';

describe('LoadingState', () => {
  it('enseña el logo latiendo y la frase solo la anuncia al lector de pantalla', async () => {
    await render(<LoadingState label="Cargando la sesión…" />);

    expect(screen.getByRole('progressbar', { name: 'Cargando la sesión…' })).toBeTruthy();
    expect(screen.queryByText('Cargando la sesión…')).toBeNull();
  });
});

it('LoadingState añade la línea de contexto si la hay', async () => {
  await render(<LoadingState label="Un momento…" detail="Aplicando el enlace." />);

  expect(screen.getByText('Aplicando el enlace.')).toBeVisible();
  expect(
    screen.getByRole('progressbar', { name: 'Un momento… Aplicando el enlace.' })
  ).toBeTruthy();
});

describe('MessageState', () => {
  it('pinta etiqueta, titular, cuerpo, detalle y acciones', async () => {
    await render(
      <MessageState
        eyebrow="Error"
        eyebrowColor="danger"
        title="No hemos podido cargar"
        body="Inténtalo otra vez."
        detail="timeout">
        <Button label="Reintentar" onPress={() => {}} />
      </MessageState>
    );

    expect(screen.getByText('Error')).toHaveStyle({ color: Colors.light.danger });
    expect(screen.getByText('No hemos podido cargar')).toBeVisible();
    expect(screen.getByText('Inténtalo otra vez.')).toBeVisible();
    expect(screen.getByText('timeout')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });

  it('sin piezas opcionales no deja huecos con texto vacío', async () => {
    await render(<MessageState title="Solo titular" />);

    expect(screen.getByText('Solo titular')).toBeVisible();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
