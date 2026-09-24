/**
 * El sello certifica la autoría del enlace de GitHub, no la identidad de la
 * persona. Ambas variantes deben decir a quién pertenece el enlace, también
 * al lector de pantalla, sin prometer un perfil o una persona verificados.
 */

import { render, screen } from '@testing-library/react-native';

import { GithubSeal } from './github-seal';

function setup(compact?: boolean) {
  return { ui: <GithubSeal handle="nuria-dev" compact={compact} /> };
}

describe('GithubSeal', () => {
  it('en compacto muestra GitHub y el handle como texto visible', async () => {
    const { ui } = setup(true);
    await render(ui);

    expect(screen.getByText('✓ GitHub @nuria-dev')).toBeVisible();
  });

  it('por defecto muestra el handle y la verificación en la variante completa', async () => {
    const { ui } = setup();
    await render(ui);

    expect(screen.getByText('✓ @nuria-dev · verificado')).toBeVisible();
  });

  describe.each([
    ['compacta', true],
    ['completa', false],
  ] as const)('variante %s', (_variant, compact) => {
    it('anuncia exactamente qué cuenta de GitHub está verificada', async () => {
      const { ui } = setup(compact);
      await render(ui);

      expect(screen.getByLabelText('GitHub verificado: nuria-dev')).toBeOnTheScreen();
    });

    it('no promete que el perfil ni la persona estén verificados', async () => {
      const { ui } = setup(compact);
      await render(ui);

      expect(screen.queryByText(/perfil verificado/i)).toBeNull();
      expect(screen.queryByText(/persona verificada/i)).toBeNull();
      expect(screen.queryByLabelText(/perfil verificado/i)).toBeNull();
      expect(screen.queryByLabelText(/persona verificada/i)).toBeNull();
    });
  });
});
