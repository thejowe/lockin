/**
 * Tests de la ficha de perfil en lectura.
 *
 * Lo único que esta ficha puede romper en silencio es la distinción entre lo
 * que la persona aporta y lo que busca: si las dos listas de especialidades se
 * mezclan, se lee un perfil que dice lo contrario de lo que dice. Eso es lo que
 * se comprueba aquí, más la invariante de lock-in (que no busca skills).
 *
 * Los enlaces son logos de las apps conectadas (`ConnectedApps`, 2026-10-17)
 * que abren con `Linking.openURL`: se espía para comprobar que cada logo lleva
 * a su enlace y no solo que se pinta.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { buildProfile } from '@/data/test-fixtures';

import { ProfileDetails } from './profile-details';

let openURL: jest.SpyInstance;

beforeEach(() => {
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});

afterEach(() => openURL.mockRestore());

describe('ProfileDetails', () => {
  it('la cámara de la foto solo existe en el perfil propio y abre la hoja', async () => {
    const onAvatarPress = jest.fn();
    await render(<ProfileDetails profile={buildProfile()} onAvatarPress={onAvatarPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Cambiar foto de perfil' }));
    expect(onAvatarPress).toHaveBeenCalledTimes(1);

    await render(<ProfileDetails profile={buildProfile()} />);
    expect(screen.queryByRole('button', { name: 'Cambiar foto de perfil' })).toBeNull();
  });

  it('cada bloque propio lleva su lápiz y abre su sección', async () => {
    const onEdit = jest.fn();
    await render(<ProfileDetails profile={buildProfile()} onEdit={onEdit} />);

    for (const [name, section] of [
      ['Editar nombre, edad y ubicación', 'basics'],
      ['Editar lo que dominas y lo que buscas', 'specialties'],
      ['Editar cómo trabajas', 'work'],
      ['Editar enlaces y redes', 'links'],
    ] as const) {
      await fireEvent.press(screen.getByRole('button', { name }));
      expect(onEdit).toHaveBeenLastCalledWith(section);
    }
    expect(screen.getAllByRole('button', { name: 'Editar tus respuestas' }).length).toBeGreaterThan(
      0
    );

    await render(<ProfileDetails profile={buildProfile()} />);
    expect(screen.queryByRole('button', { name: /^Editar / })).toBeNull();
  });

  it('separa lo que domina de lo que busca', async () => {
    await render(
      <ProfileDetails
        profile={buildProfile({
          lookingFor: 'par',
          specialties: ['dev'],
          seekingSpecialties: ['marketing'],
        })}
      />
    );

    expect(screen.getByText('Lo que domina')).toBeTruthy();
    expect(screen.getByText('Lo que busca')).toBeTruthy();
    expect(screen.getByText('Desarrollo')).toBeTruthy();
    expect(screen.getByText('Marketing')).toBeTruthy();
  });

  it('lee un seekingSpecialties vacío como "abierto", no como dato ausente', async () => {
    await render(
      <ProfileDetails profile={buildProfile({ lookingFor: 'ambos', seekingSpecialties: [] })} />
    );

    expect(screen.getByText('Lo que busca')).toBeTruthy();
    expect(screen.getByText('Abierto a cualquier especialidad.')).toBeTruthy();
  });

  it('no habla de especialidades buscadas en un perfil de lock-in', async () => {
    await render(<ProfileDetails profile={buildProfile({ lookingFor: 'lockin' })} />);

    expect(screen.getByText('Lo que domina')).toBeTruthy();
    expect(screen.queryByText('Lo que busca')).toBeNull();
    expect(screen.queryByText('Abierto a cualquier especialidad.')).toBeNull();
  });

  describe('apps conectadas', () => {
    it('pinta un logo por cada app con enlace, y cada uno abre su cuenta', async () => {
      const profile = buildProfile({
        links: {
          github: 'https://github.com/nuria',
          linkedin: 'https://linkedin.com/in/nuria',
          instagram: 'https://instagram.com/nuria',
          tiktok: 'https://tiktok.com/@nuria',
        },
      });
      await render(<ProfileDetails profile={profile} />);

      expect(screen.getByText('Redes y enlaces')).toBeTruthy();
      // Instagram y TikTok llevan además el `@usuario` del enlace.
      for (const [app, url] of [
        ['GitHub', 'https://github.com/nuria'],
        ['LinkedIn', 'https://linkedin.com/in/nuria'],
        ['Instagram, @nuria', 'https://instagram.com/nuria'],
        ['TikTok, @nuria', 'https://tiktok.com/@nuria'],
      ]) {
        const [name, handle] = app.split(', ');
        const label = `Abrir el ${name} de ${profile.name}${handle ? `, ${handle}` : ''}`;
        await fireEvent.press(screen.getByLabelText(label));
        expect(openURL).toHaveBeenLastCalledWith(url);
      }
      // La web no está en el perfil: no puede aparecer un logo que no lleva a nada.
      expect(screen.queryByLabelText(`Abrir el Web de ${profile.name}`)).toBeNull();
    });

    it('no abre esquemas que no sean http(s), aunque lleguen en la fila', async () => {
      const profile = buildProfile({
        links: {
          github: 'javascript:alert(1)',
          portfolio: 'intent://scan#Intent;scheme=zxing;end',
          instagram: 'https://instagram.com/nuria',
        },
      });
      await render(<ProfileDetails profile={profile} />);

      expect(screen.queryByLabelText(`Abrir el GitHub de ${profile.name}`)).toBeNull();
      expect(screen.queryByLabelText(`Abrir el Web de ${profile.name}`)).toBeNull();
      expect(screen.getByLabelText(`Abrir el Instagram de ${profile.name}, @nuria`)).toBeTruthy();
    });

    it('se calla la fila entera cuando no hay ningún enlace', async () => {
      await render(<ProfileDetails profile={buildProfile({ links: {} })} />);

      expect(screen.queryByText('Redes y enlaces')).toBeNull();
    });

    it('sella el GitHub verificado junto a su logo', async () => {
      await render(
        <ProfileDetails
          profile={buildProfile({
            links: { github: 'https://github.com/anagarcia' },
            githubVerification: { handle: 'anagarcia', verifiedAt: '2026-09-16T10:00:00.000Z' },
          })}
        />
      );

      expect(screen.getByLabelText('GitHub verificado: anagarcia')).toBeTruthy();
    });

    it('sin sello, el enlace se pinta como siempre y sin ningún negativo', async () => {
      await render(
        <ProfileDetails
          profile={buildProfile({
            links: { github: 'https://github.com/anagarcia' },
            githubVerification: null,
          })}
        />
      );

      expect(screen.getByLabelText(/^Abrir el GitHub de /)).toBeTruthy();
      expect(screen.queryByLabelText(/GitHub verificado/)).toBeNull();
      expect(screen.queryByText(/sin verificar/i)).toBeNull();
    });
  });
});
