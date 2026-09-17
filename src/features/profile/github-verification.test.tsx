/**
 * Tests del panel de verificación de GitHub del perfil propio.
 *
 * Este panel es el ÚNICO punto de la app con acción de verificar: en la ficha
 * ajena y en el deck el sello solo se mira. Por eso lo que se prueba aquí es
 * justo lo que puede salir mal al accionarlo:
 *
 * - que el sello se anuncie con texto y no solo con un icono (sin
 *   `accessibilityLabel` un lector de pantalla no lee nada),
 * - que verificar no pise en silencio un enlace escrito a mano,
 * - y que cancelar en GitHub no se presente como un fallo, porque no lo es.
 *
 * Los repositorios son los del mock, con espías encima: el panel llama al
 * contrato (`verifyGithub` / `unverifyGithub`) y nunca escribe el sello él
 * mismo — el cliente no puede declarar su propia verificación.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DataProvider } from '@/data';
import { createMockRepositories, resetState } from '@/data/mock';
import { buildProfile } from '@/data/test-fixtures';

import { GithubVerification } from './github-verification';

import type { Profile, Repositories } from '@/data';

let repositories: Repositories;
let verifyGithub: jest.SpyInstance<Promise<Profile>, []>;
let unverifyGithub: jest.SpyInstance<Promise<Profile>, []>;
let onChange: jest.Mock;

beforeEach(() => {
  // `createMockRepositories()` devuelve siempre los mismos objetos de módulo:
  // sin restaurar, un espía sobrevive al test siguiente.
  jest.restoreAllMocks();
  resetState();
  repositories = createMockRepositories();
  verifyGithub = jest.spyOn(repositories.profiles, 'verifyGithub');
  unverifyGithub = jest.spyOn(repositories.profiles, 'unverifyGithub');
  onChange = jest.fn();
});

/** Monta el panel tal y como lo monta la tab Perfil, con su perfil ya resuelto. */
async function renderOwnProfile(profile: Profile) {
  return render(
    <DataProvider value={repositories}>
      <GithubVerification profile={profile} onChange={onChange} />
    </DataProvider>
  );
}

const SELLADO: Profile = buildProfile({
  links: { github: 'https://github.com/anagarcia' },
  githubVerification: { handle: 'anagarcia', verifiedAt: '2026-09-16T10:00:00.000Z' },
});

describe('GithubVerification', () => {
  it('sin sello, ofrece verificar', async () => {
    await renderOwnProfile(buildProfile({ githubVerification: null }));

    expect(screen.getByText('Verificar con GitHub')).toBeTruthy();
  });

  it('con sello, lo anuncia y ofrece quitarlo', async () => {
    await renderOwnProfile(SELLADO);

    // No puede ser solo un icono: sin label, un lector de pantalla no lo lee.
    expect(screen.getByLabelText('GitHub verificado: anagarcia')).toBeTruthy();
    expect(screen.getByText('Quitar verificación')).toBeTruthy();
    expect(screen.queryByText('Verificar con GitHub')).toBeNull();
  });

  it('el sello dice de qué es: certifica el enlace, no a la persona', async () => {
    await renderOwnProfile(SELLADO);

    // La spec lo fija como innegociable: ni «perfil verificado» ni un check a
    // secas junto al nombre. El copy nombra GitHub.
    expect(screen.getByText(/enlace de GitHub/i)).toBeTruthy();
  });

  it('avisa antes de sobrescribir un enlace escrito a mano', async () => {
    await renderOwnProfile(
      buildProfile({
        links: { github: 'https://github.com/otracosa' },
        githubVerification: null,
      })
    );

    await fireEvent.press(screen.getByText('Verificar con GitHub'));

    // En la pantalla, no en un diálogo del sistema: un modal bloqueante deja la
    // app sin responder a nada más.
    expect(await screen.findByText(/otracosa/)).toBeTruthy();
    expect(verifyGithub).not.toHaveBeenCalled();
  });

  it('desde el aviso se puede continuar, y entonces sí verifica', async () => {
    await renderOwnProfile(
      buildProfile({
        links: { github: 'https://github.com/otracosa' },
        githubVerification: null,
      })
    );
    await fireEvent.press(screen.getByText('Verificar con GitHub'));

    await fireEvent.press(screen.getByText('Continuar y sobrescribir'));

    await waitFor(() => expect(verifyGithub).toHaveBeenCalled());
  });

  it('desde el aviso se puede echar atrás sin verificar nada', async () => {
    await renderOwnProfile(
      buildProfile({
        links: { github: 'https://github.com/otracosa' },
        githubVerification: null,
      })
    );
    await fireEvent.press(screen.getByText('Verificar con GitHub'));

    await fireEvent.press(screen.getByText('Dejarlo como está'));

    expect(screen.queryByText(/otracosa/)).toBeNull();
    expect(verifyGithub).not.toHaveBeenCalled();
  });

  it('sin enlace previo, verificar no pregunta nada: no hay nada que pisar', async () => {
    await repositories.profiles.saveCurrent({
      ...buildProfile({ links: {} }),
      name: 'Ana García',
    });
    await renderOwnProfile(buildProfile({ links: {}, githubVerification: null }));

    await fireEvent.press(screen.getByText('Verificar con GitHub'));

    await waitFor(() => expect(verifyGithub).toHaveBeenCalled());
    // Quien monta el panel es quien relee el perfil: el panel no guarda estado
    // de perfil propio, así no hay dos versiones del mismo dato en pantalla.
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it('cancelar en GitHub no es un error', async () => {
    verifyGithub.mockRejectedValue(new Error('Verificación cancelada.'));
    await renderOwnProfile(buildProfile({ githubVerification: null }));

    await fireEvent.press(screen.getByText('Verificar con GitHub'));

    expect(await screen.findByText(/no se completó/i)).toBeTruthy();
    expect(screen.queryByText(/error/i)).toBeNull();
  });

  it('un fallo de verdad sí se cuenta, con el motivo del proveedor', async () => {
    verifyGithub.mockRejectedValue(
      new Error('Esa cuenta de GitHub ya está verificada en otro perfil de LockIn.')
    );
    await renderOwnProfile(buildProfile({ githubVerification: null }));

    await fireEvent.press(screen.getByText('Verificar con GitHub'));

    expect(
      await screen.findByText('Esa cuenta de GitHub ya está verificada en otro perfil de LockIn.')
    ).toBeTruthy();
  });

  it('quitar la verificación llama al contrato y avisa a quien lo monta', async () => {
    unverifyGithub.mockResolvedValue(buildProfile({ links: {}, githubVerification: null }));
    await renderOwnProfile(SELLADO);

    await fireEvent.press(screen.getByText('Quitar verificación'));

    await waitFor(() => expect(unverifyGithub).toHaveBeenCalled());
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it('mientras trabaja, el botón no se puede pulsar dos veces', async () => {
    let resolve: (profile: Profile) => void = () => {};
    verifyGithub.mockReturnValue(
      new Promise<Profile>((done) => {
        resolve = done;
      })
    );
    await renderOwnProfile(buildProfile({ githubVerification: null }));

    await fireEvent.press(screen.getByText('Verificar con GitHub'));
    // Mientras el navegador está abierto el botón cambia de texto Y se
    // deshabilita: sin lo segundo, dos toques abrirían dos flujos de OAuth.
    await fireEvent.press(screen.getByText('Abriendo GitHub…'));

    expect(verifyGithub).toHaveBeenCalledTimes(1);

    // Soltar la promesa dentro de `waitFor` (que envuelve en `act`) en vez de
    // dejarla resolver después del test: si no, el `setState` final cae fuera
    // del árbol montado y React lo avisa por consola en cada pasada.
    resolve(buildProfile());
    await waitFor(() => expect(screen.getByText('Verificar con GitHub')).toBeTruthy());
  });
});
