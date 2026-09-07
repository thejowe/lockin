/**
 * Tests de la ficha de perfil en lectura.
 *
 * Lo único que esta ficha puede romper en silencio es la distinción entre lo
 * que la persona aporta y lo que busca: si las dos listas de especialidades se
 * mezclan, se lee un perfil que dice lo contrario de lo que dice. Eso es lo que
 * se comprueba aquí, más la invariante de lock-in (que no busca skills).
 *
 * `ExternalLink` se sustituye porque abrir el navegador no es asunto de esta
 * ficha y arrastra `expo-router` sin necesidad. El doble apunta el `href` que
 * recibe: así el test puede comprobar que cada etiqueta lleva a su enlace y no
 * solo que se pintan tres textos.
 */

import { render, screen } from '@testing-library/react-native';

import { buildProfile } from '@/data/test-fixtures';

import { ProfileDetails } from './profile-details';

const mockLinkHrefs: string[] = [];

jest.mock('@/components/external-link', () => ({
  ExternalLink: ({ href, children }: { href: string; children: React.ReactNode }) => {
    mockLinkHrefs.push(href);
    return children;
  },
}));

beforeEach(() => {
  mockLinkHrefs.length = 0;
});

describe('ProfileDetails', () => {
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

  describe('enlaces', () => {
    it('pinta solo los que el perfil tiene, cada uno con su href', async () => {
      await render(
        <ProfileDetails
          profile={buildProfile({
            links: {
              github: 'https://github.com/nuria',
              linkedin: 'https://linkedin.com/in/nuria',
            },
          })}
        />
      );

      expect(screen.getByText('Enlaces')).toBeTruthy();
      expect(screen.getByText('GitHub')).toBeTruthy();
      expect(screen.getByText('LinkedIn')).toBeTruthy();
      // El portfolio no está en el perfil: no puede aparecer con un href vacío.
      expect(screen.queryByText('Portfolio')).toBeNull();
      expect(mockLinkHrefs).toEqual(['https://github.com/nuria', 'https://linkedin.com/in/nuria']);
    });

    it('se calla la sección entera cuando no hay ningún enlace', async () => {
      await render(<ProfileDetails profile={buildProfile({ links: {} })} />);

      expect(screen.queryByText('Enlaces')).toBeNull();
      expect(mockLinkHrefs).toEqual([]);
    });
  });
});
