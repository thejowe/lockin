/**
 * Sin matches, la pantalla explica que hacen falta likes recíprocos y ofrece
 * volver a Descubrir. Fijamos el mensaje y el destino para no dejar a quien
 * llega por primera vez sin saber cómo empezar una conversación.
 *
 * Como en match-row.test.tsx, sustituimos Link sin montar el router. Este doble
 * conserva al hijo y conecta su pulsación con el href recibido para comprobar
 * el destino elegido por el componente, no la implementación de Expo Router.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { MatchesEmpty } from './matches-empty';

let mockNavigate: jest.Mock;

jest.mock('expo-router', () => ({
  Link: ({
    children,
    href,
  }: {
    children: React.ReactElement<{ onPress: () => void }>;
    href: string;
  }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    return React.cloneElement(children, { onPress: () => mockNavigate(href) });
  },
}));

function setup() {
  mockNavigate = jest.fn();
  return { onNavigate: mockNavigate, ui: <MatchesEmpty /> };
}

describe('MatchesEmpty', () => {
  it('explica que los matches aparecen cuando dos personas se dan like', async () => {
    const { ui } = setup();
    await render(ui);

    expect(screen.getByText('Todavía no hay nadie al otro lado')).toBeVisible();
    expect(
      screen.getByText(
        'Un match aparece aquí cuando dos personas se dan like. Sigue pasando tarjetas en Descubrir y en cuanto haya reciprocidad tendrás con quién hablar.'
      )
    ).toBeVisible();
  });

  it('ofrece ir a Descubrir y al pulsar lleva a esa ruta', async () => {
    const { onNavigate, ui } = setup();
    await render(ui);

    expect(screen.getByText('Ir a Descubrir')).toBeVisible();
    expect(onNavigate).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Ir a Descubrir' }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('/discover');
  });
});
