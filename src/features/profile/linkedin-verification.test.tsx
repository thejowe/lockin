/**
 * LinkedIn en «Vincular cuentas», contra el mock (que simula el sello).
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DataProvider, LINKEDIN_VERIFICATION_CANCELLED } from '@/data';
import { createMockRepositories, resetState } from '@/data/mock';
import { buildProfileInput } from '@/data/test-fixtures';

import { LinkedinVerification } from './linkedin-verification';

import type { Profile, Repositories } from '@/data';

let repositories: Repositories;

beforeEach(async () => {
  resetState();
  repositories = createMockRepositories();
  await repositories.session.setActiveMode('par');
  await repositories.profiles.saveCurrent(buildProfileInput({ name: 'Ana García' }));
});

async function renderPanel(profile: Profile, onChange = jest.fn()) {
  await render(
    <DataProvider value={repositories}>
      <LinkedinVerification profile={profile} onChange={onChange} />
    </DataProvider>
  );
  return onChange;
}

it('sin sello ofrece vincular, y al vincular avisa para releer el perfil', async () => {
  const profile = (await repositories.profiles.getCurrent()) as Profile;
  const onChange = await renderPanel(profile);

  await fireEvent.press(screen.getByRole('button', { name: 'Vincular LinkedIn' }));

  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  const after = await repositories.profiles.getCurrent();
  expect(after?.linkedinVerification?.name).toBe('Ana García');
});

it('con sello lo enseña y ofrece desvincular', async () => {
  const profile = await repositories.profiles.verifyLinkedin();
  await renderPanel(profile);

  expect(screen.getByLabelText('LinkedIn verificado: Ana García')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Desvincular LinkedIn' }));

  await waitFor(async () =>
    expect((await repositories.profiles.getCurrent())?.linkedinVerification).toBeNull()
  );
});

it('cancelar no es un error rojo: dice que no ha cambiado nada', async () => {
  jest
    .spyOn(repositories.profiles, 'verifyLinkedin')
    .mockRejectedValue(new Error(LINKEDIN_VERIFICATION_CANCELLED));
  const profile = (await repositories.profiles.getCurrent()) as Profile;
  await renderPanel(profile);

  await fireEvent.press(screen.getByRole('button', { name: 'Vincular LinkedIn' }));

  expect(await screen.findByText('No se completó. No ha cambiado nada.')).toBeTruthy();
});

it('editar el perfil no quita el sello', async () => {
  await repositories.profiles.verifyLinkedin();
  await repositories.profiles.saveCurrent(buildProfileInput({ name: 'Ana García' }));

  expect((await repositories.profiles.getCurrent())?.linkedinVerification?.name).toBe('Ana García');
});
