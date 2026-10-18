/**
 * «Vincular cuentas» como fila de logos (2026-10-18), contra el mock.
 *
 * Lo que puede salir mal al accionarlo, que es lo que se prueba:
 * - que un logo diga si está vinculado sin depender del color (label),
 * - que vincular GitHub no pise en silencio un enlace escrito a mano,
 * - que cancelar en el proveedor no se presente como un fallo,
 * - que un proveedor sin configurar no abra nada.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DataProvider, LINKEDIN_VERIFICATION_CANCELLED } from '@/data';
import { createMockRepositories, resetState } from '@/data/mock';
import { buildProfile, buildProfileInput } from '@/data/test-fixtures';

import { LinkAccounts } from './link-accounts';

import type { Profile, Repositories } from '@/data';

let repositories: Repositories;
let onChange: jest.Mock;

beforeEach(async () => {
  // `createMockRepositories()` devuelve siempre los mismos objetos de módulo:
  // sin restaurar, un espía sobrevive al test siguiente.
  jest.restoreAllMocks();
  resetState();
  repositories = createMockRepositories();
  await repositories.session.setActiveMode('par');
  await repositories.profiles.saveCurrent(buildProfileInput({ name: 'Ana García', links: {} }));
  onChange = jest.fn();
});

async function renderRow(
  profile: Profile,
  available: { github: boolean; linkedin: boolean } = { github: true, linkedin: true }
) {
  await render(
    <DataProvider value={repositories}>
      <LinkAccounts profile={profile} onChange={onChange} available={available} />
    </DataProvider>
  );
}

const GITHUB_SELLADO: Profile = buildProfile({
  links: { github: 'https://github.com/anagarcia' },
  githubVerification: { handle: 'anagarcia', verifiedAt: '2026-09-16T10:00:00.000Z' },
});

it('sin nada vinculado, los dos logos ofrecen vincular', async () => {
  await renderRow(buildProfile({ links: {}, githubVerification: null }));

  expect(screen.getByRole('button', { name: 'Vincular GitHub' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Vincular LinkedIn' })).toBeTruthy();
});

it('tocar un logo gris vincula directamente y avisa para releer', async () => {
  const verifyGithub = jest.spyOn(repositories.profiles, 'verifyGithub');
  await renderRow(buildProfile({ links: {}, githubVerification: null }));

  await fireEvent.press(screen.getByRole('button', { name: 'Vincular GitHub' }));

  await waitFor(() => expect(verifyGithub).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(onChange).toHaveBeenCalled());
});

it('LinkedIn: tocar su logo lo vincula y deja el sello', async () => {
  const profile = (await repositories.profiles.getCurrent()) as Profile;
  await renderRow(profile);

  await fireEvent.press(screen.getByRole('button', { name: 'Vincular LinkedIn' }));

  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  expect((await repositories.profiles.getCurrent())?.linkedinVerification?.name).toBe('Ana García');
});

it('un logo vinculado lo dice con texto, y al tocarlo deja desvincular', async () => {
  const unverifyGithub = jest
    .spyOn(repositories.profiles, 'unverifyGithub')
    .mockResolvedValue(buildProfile({ links: {}, githubVerification: null }));
  await renderRow(GITHUB_SELLADO);

  const tile = screen.getByRole('button', { name: 'GitHub vinculado' });
  expect(screen.queryByText('Desvincular GitHub')).toBeNull();

  await fireEvent.press(tile);
  expect(screen.getByLabelText('GitHub verificado: anagarcia')).toBeTruthy();
  await fireEvent.press(screen.getByText('Desvincular GitHub'));

  await waitFor(() => expect(unverifyGithub).toHaveBeenCalled());
  await waitFor(() => expect(onChange).toHaveBeenCalled());
});

it('avisa antes de sobrescribir un enlace de GitHub escrito a mano', async () => {
  const verifyGithub = jest.spyOn(repositories.profiles, 'verifyGithub');
  await renderRow(
    buildProfile({ links: { github: 'https://github.com/otracosa' }, githubVerification: null })
  );

  await fireEvent.press(screen.getByRole('button', { name: 'Vincular GitHub' }));

  expect(await screen.findByText(/otracosa/)).toBeTruthy();
  expect(verifyGithub).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByText('Dejarlo como está'));
  expect(screen.queryByText(/otracosa/)).toBeNull();
  expect(verifyGithub).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole('button', { name: 'Vincular GitHub' }));
  await fireEvent.press(screen.getByText('Continuar y sobrescribir'));
  await waitFor(() => expect(verifyGithub).toHaveBeenCalledTimes(1));
});

it('cancelar en el proveedor no es un error rojo', async () => {
  jest
    .spyOn(repositories.profiles, 'verifyLinkedin')
    .mockRejectedValue(new Error(LINKEDIN_VERIFICATION_CANCELLED));
  await renderRow(buildProfile({ links: {}, githubVerification: null }));

  await fireEvent.press(screen.getByRole('button', { name: 'Vincular LinkedIn' }));

  expect(await screen.findByText('No se completó. No ha cambiado nada.')).toBeTruthy();
});

it('un fallo de verdad se cuenta con el motivo', async () => {
  jest
    .spyOn(repositories.profiles, 'verifyGithub')
    .mockRejectedValue(new Error('Esa cuenta de GitHub ya está verificada en otro perfil.'));
  await renderRow(buildProfile({ links: {}, githubVerification: null }));

  await fireEvent.press(screen.getByRole('button', { name: 'Vincular GitHub' }));

  expect(
    await screen.findByText('Esa cuenta de GitHub ya está verificada en otro perfil.')
  ).toBeTruthy();
});

it('un proveedor sin configurar sale como «Pronto» y no abre nada', async () => {
  const verifyLinkedin = jest.spyOn(repositories.profiles, 'verifyLinkedin');
  await renderRow(buildProfile({ links: {}, githubVerification: null }), {
    github: true,
    linkedin: false,
  });

  expect(screen.getByText('Pronto')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Vincular LinkedIn' }));

  expect(await screen.findByText(/todavía no está disponible/)).toBeTruthy();
  expect(verifyLinkedin).not.toHaveBeenCalled();
});

it('mientras vincula, ningún logo abre un segundo flujo', async () => {
  let resolve: (profile: Profile) => void = () => {};
  const verifyGithub = jest.spyOn(repositories.profiles, 'verifyGithub').mockReturnValue(
    new Promise<Profile>((done) => {
      resolve = done;
    })
  );
  const verifyLinkedin = jest.spyOn(repositories.profiles, 'verifyLinkedin');
  await renderRow(buildProfile({ links: {}, githubVerification: null }));

  await fireEvent.press(screen.getByRole('button', { name: 'Vincular GitHub' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Vincular GitHub' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Vincular LinkedIn' }));

  expect(verifyGithub).toHaveBeenCalledTimes(1);
  expect(verifyLinkedin).not.toHaveBeenCalled();

  resolve(buildProfile());
  await waitFor(() => expect(onChange).toHaveBeenCalled());
});

it('editar el perfil no quita el sello de LinkedIn', async () => {
  await repositories.profiles.verifyLinkedin();
  await repositories.profiles.saveCurrent(buildProfileInput({ name: 'Ana García' }));

  expect((await repositories.profiles.getCurrent())?.linkedinVerification?.name).toBe('Ana García');
});
