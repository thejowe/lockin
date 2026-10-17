/**
 * Tests de la tarjeta del deck.
 *
 * Lo que se prueba aquí es una sola cosa, pero es la que decide el swipe: que
 * "lo que domina" y "lo que busca" no se confundan, y que el encaje con lo que
 * uno mismo domina se vea sin depender del color — ni un lector de pantalla ni
 * quien no distingue latón de latón suave leen un chip por su fondo.
 *
 * Ojo: en RNTL 14 `render` es asíncrono.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/theme';
import { buildProfile } from '@/data/test-fixtures';

import { ProfileCard } from './profile-card';

/** Contraste WCAG del color que llega al ojo, incluyendo el alfa del velo. */
function contrastRatio(ink: string, background: string, scrim?: string, opacity = 1): number {
  const rgb = (hex: string) =>
    [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const alpha = scrim ? parseInt(scrim.slice(7, 9), 16) / 255 : 0;
  const under = rgb(background);
  const mixed = scrim
    ? rgb(scrim).map((value, i) => value * alpha + under[i] * (1 - alpha))
    : under;
  const luminance = (channels: number[]) =>
    channels
      .map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  const a = luminance(rgb(ink).map((value, i) => value * opacity + mixed[i] * (1 - opacity)));
  const b = luminance(mixed);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const HIDDEN = { includeHiddenElements: true };

describe('ProfileCard', () => {
  it('ofrece Bloquear y Reportar desde las opciones de la tarjeta', async () => {
    await render(<ProfileCard profile={buildProfile({ name: 'Núria' })} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Opciones de Núria' }));
    expect(screen.getByRole('button', { name: 'Bloquear a Núria' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reportar a Núria' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar opciones' }));
    expect(screen.getByText('Domina')).toBeTruthy();
  });
  it('con el panel controlado desde fuera, avisa de cada apertura y cierre', async () => {
    const onSafetyOpenChange = jest.fn();
    const profile = buildProfile({ name: 'Núria' });
    const view = await render(
      <ProfileCard profile={profile} safetyOpen={false} onSafetyOpenChange={onSafetyOpenChange} />
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Opciones de Núria' }));
    expect(onSafetyOpenChange).toHaveBeenLastCalledWith(true);
    // El padre manda: sin reabrir la prop, la tarjeta sigue en su contenido normal.
    expect(screen.queryByRole('button', { name: 'Bloquear a Núria' })).toBeNull();

    await view.rerender(
      <ProfileCard profile={profile} safetyOpen onSafetyOpenChange={onSafetyOpenChange} />
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar opciones' }));
    expect(onSafetyOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('separa lo que domina de lo que busca, cada uno bajo su etiqueta', async () => {
    const profile = buildProfile({
      lookingFor: 'par',
      specialties: ['dev', 'datos'],
      seekingSpecialties: ['marketing', 'ventas'],
    });

    await render(<ProfileCard profile={profile} />);

    expect(screen.getByText('Domina')).toBeTruthy();
    expect(screen.getByText('Busca')).toBeTruthy();
    expect(screen.getByText('Desarrollo')).toBeTruthy();
    expect(screen.getByText('Marketing')).toBeTruthy();
  });

  it('marca con "✓" lo que la otra persona busca y quien mira ya domina', async () => {
    const profile = buildProfile({
      lookingFor: 'par',
      specialties: ['dev'],
      seekingSpecialties: ['marketing', 'ventas'],
    });

    await render(<ProfileCard profile={profile} viewerSpecialties={['marketing']} />);

    expect(screen.getByText('✓ Marketing')).toBeTruthy();
    // Lo que también busca pero uno no domina se queda sin marca.
    expect(screen.getByText('Ventas')).toBeTruthy();
    expect(screen.getByText('✓ Encajas')).toBeTruthy();
  });

  it('sin encaje no inventa la señal', async () => {
    const profile = buildProfile({
      lookingFor: 'par',
      specialties: ['dev'],
      seekingSpecialties: ['marketing'],
    });

    await render(<ProfileCard profile={profile} viewerSpecialties={['legal']} />);

    expect(screen.queryByText('✓ Encajas')).toBeNull();
    expect(screen.getByText('Marketing')).toBeTruthy();
  });

  it('no resalta nada mientras el perfil propio no ha cargado', async () => {
    const profile = buildProfile({
      lookingFor: 'par',
      specialties: ['dev'],
      seekingSpecialties: ['marketing'],
    });

    await render(<ProfileCard profile={profile} />);

    expect(screen.queryByText('✓ Encajas')).toBeNull();
  });

  it('en un perfil de lock-in no hay fila de "busca": no se elige por skills', async () => {
    const profile = buildProfile({ lookingFor: 'lockin', specialties: ['dev'] });

    await render(<ProfileCard profile={profile} viewerSpecialties={['dev', 'marketing']} />);

    expect(screen.getByText('Domina')).toBeTruthy();
    expect(screen.queryByText('Busca')).toBeNull();
    expect(screen.queryByText('✓ Encajas')).toBeNull();
  });

  it('un "busca" vacío se lee como apertura, no como dato ausente', async () => {
    const profile = buildProfile({
      lookingFor: 'ambos',
      specialties: ['dev'],
      seekingSpecialties: [],
    });

    await render(<ProfileCard profile={profile} viewerSpecialties={['dev']} />);

    expect(screen.getByText('Cualquier especialidad')).toBeTruthy();
    // Con la puerta abierta a todo el mundo, "encajas" no significaría nada.
    expect(screen.queryByText('✓ Encajas')).toBeNull();
  });

  describe('sello de GitHub', () => {
    it('enseña el sello de quien lo tiene', async () => {
      const profile = buildProfile({
        links: { github: 'https://github.com/anagarcia' },
        githubVerification: { handle: 'anagarcia', verifiedAt: '2026-09-16T10:00:00.000Z' },
      });

      await render(<ProfileCard profile={profile} />);

      // Con etiqueta explícita: de un icono, un lector de pantalla no lee nada.
      expect(screen.getByLabelText('GitHub verificado: anagarcia')).toBeTruthy();
    });

    it('sin sello no dice nada: no hay marca de "sin verificar"', async () => {
      await render(<ProfileCard profile={buildProfile({ githubVerification: null })} />);

      expect(screen.queryByLabelText(/GitHub verificado/)).toBeNull();
      // Marcar lo NO verificado castiga a las nueve especialidades que no
      // tienen GitHub, y es filtrar por profesión por la puerta del copy.
      expect(screen.queryByText(/sin verificar/i)).toBeNull();
    });

    it('el sello nombra GitHub: no es un check a secas junto al nombre', async () => {
      const profile = buildProfile({
        githubVerification: { handle: 'anagarcia', verifiedAt: '2026-09-16T10:00:00.000Z' },
      });

      await render(<ProfileCard profile={profile} />);

      // Un "✓" solo se leería como «perfil verificado», que es justo lo que
      // este sello NO dice: certifica el enlace y nada más.
      expect(screen.getByText(/GitHub @anagarcia/)).toBeTruthy();
    });
  });

  it('no dice qué modo busca: el producto es solo cofundador', async () => {
    await render(<ProfileCard profile={buildProfile({ lookingFor: 'par' })} />);

    expect(screen.queryByText(/^Quiere:/)).toBeNull();
  });

  describe('páginas, como las fotos de Tinder', () => {
    const profile = buildProfile({
      name: 'Núria',
      prompts: [{ question: 'Lo que me quita el sueño', answer: 'Hacer algo que dure' }],
    });

    it('empieza por quién es y qué aporta; el resto espera a un toque', async () => {
      await render(<ProfileCard profile={profile} />);

      expect(screen.getByText('Núria')).toBeTruthy();
      expect(screen.getByText('Domina')).toBeTruthy();
      expect(screen.queryByText('Punto de partida')).toBeNull();
      expect(screen.queryByText('Hacer algo que dure')).toBeNull();
    });

    it('un toque en la tarjeta avanza de bloque y tras el último vuelve al primero', async () => {
      await render(<ProfileCard profile={profile} />);

      await fireEvent.press(screen.getByRole('button', { name: 'Ver cuándo trabaja' }));
      expect(screen.getByText('Punto de partida')).toBeTruthy();
      expect(screen.queryByText('Domina')).toBeNull();
      // El nombre no se va con la página: es lo que ancla la tarjeta.
      expect(screen.getByText('Núria')).toBeTruthy();

      await fireEvent.press(screen.getByRole('button', { name: 'Ver su respuesta' }));
      expect(screen.getByText('Hacer algo que dure')).toBeTruthy();

      await fireEvent.press(screen.getByRole('button', { name: 'Ver quién es' }));
      expect(screen.getByText('Domina')).toBeTruthy();
    });

    it('los puntos de abajo marcan en qué bloque estás', async () => {
      await render(<ProfileCard profile={profile} />);
      const dot = (page: string) =>
        StyleSheet.flatten(screen.getByTestId(`profile-card-dot-${page}`, HIDDEN).props.style)
          .backgroundColor;
      const lit = Colors.dark.text;

      expect(dot('about')).toBe(lit);
      expect(dot('schedule')).not.toBe(lit);

      await fireEvent.press(screen.getByRole('button', { name: 'Ver cuándo trabaja' }));
      expect(dot('about')).not.toBe(lit);
      expect(dot('schedule')).toBe(lit);
    });

    it('sin prompt no hay página de respuesta', async () => {
      await render(<ProfileCard profile={buildProfile({ prompts: [] })} />);

      await fireEvent.press(screen.getByRole('button', { name: 'Ver cuándo trabaja' }));
      expect(screen.getByRole('button', { name: 'Ver quién es' })).toBeTruthy();
    });
  });
});

describe('ProfileCard: foto de fondo', () => {
  // El retrato es decorado y va oculto a los lectores de pantalla: el nombre ya
  // se lee en el texto de la tarjeta.
  const HIDDEN = { includeHiddenElements: true };

  it.each([
    ['blanco', '#FFFFFF'],
    ['negro', '#000000'],
    ['foto clara', '#E0E0E0'],
    ['foto oscura', '#231C18'],
  ])('protege el menú sobre %s con al menos 3:1', async (_name, background) => {
    const base = buildProfile({ name: 'Núria' });
    const profile = { ...base, avatar: { ...base.avatar, imageUrl: 'https://x/a.jpg' } };
    await render(<ProfileCard profile={profile} />);

    const scrim = screen.getByTestId('profile-card-top-scrim', HIDDEN);
    expect(scrim).toHaveStyle(StyleSheet.absoluteFill);
    expect(scrim.props.pointerEvents).toBe('none');
    expect(scrim.props.accessibilityElementsHidden).toBe(true);
    expect(scrim.props.importantForAccessibility).toBe('no-hide-descendants');
    const veil = StyleSheet.flatten(scrim.props.style).backgroundColor;
    const menu = StyleSheet.flatten(screen.getByText('⋯', HIDDEN).props.style);

    expect(contrastRatio(menu.color, background, veil, menu.opacity)).toBeGreaterThanOrEqual(3);
    // Una sola imagen: no hay barras de página.
    expect(screen.queryByTestId('profile-card-page-about', HIDDEN)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Ver cuándo trabaja' }));
    // El velo no altera la apertura ni el retorno del panel de seguridad.
    await fireEvent.press(screen.getByRole('button', { name: 'Opciones de Núria' }));
    expect(screen.getByRole('button', { name: 'Reportar a Núria' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar opciones' }));
    expect(screen.getByText('Punto de partida')).toBeTruthy();
  });

  it('con foto la pinta de fondo y no pinta el monograma', async () => {
    const base = buildProfile({ name: 'Núria' });
    const profile = { ...base, avatar: { ...base.avatar, imageUrl: 'https://x/a.jpg' } };

    await render(<ProfileCard profile={profile} />);

    expect(screen.getByTestId('portrait-photo', HIDDEN)).toBeTruthy();
    expect(screen.queryByText(base.avatar.initials, HIDDEN)).toBeNull();
    // El texto de la tarjeta sigue ahí, encima de la foto.
    expect(screen.getByText('Domina')).toBeTruthy();
  });

  it('sin foto sigue el retrato de color con las iniciales', async () => {
    const profile = buildProfile({ name: 'Núria' });

    await render(<ProfileCard profile={profile} />);

    expect(screen.queryByTestId('portrait-photo', HIDDEN)).toBeNull();
    expect(screen.getByText(profile.avatar.initials, HIDDEN)).toBeTruthy();
  });
});
