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

import { buildProfile } from '@/data/test-fixtures';

import { ProfileCard } from './profile-card';

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

  it('el modo se lee sin confundirse con lo que busca en skills', async () => {
    const profile = buildProfile({ lookingFor: 'par' });

    await render(<ProfileCard profile={profile} />);

    expect(screen.getByText('Quiere: Cofundador')).toBeTruthy();
  });
});
