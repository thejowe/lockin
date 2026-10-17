/**
 * `/person/<id>`: el perfil completo de otra persona (2026-10-17).
 *
 * Ojo: en RNTL 14 `render` es asíncrono.
 */

import { screen, waitFor } from '@testing-library/react-native';

import { buildProfileInput } from '@/data/test-fixtures';

import { renderRoute, repositories, resetRepositories, resetRouter } from '../routes';

jest.mock('expo-router', () => {
  const mock = require('../routes').expoRouterMock();
  return { ...mock, useLocalSearchParams: () => ({ id: mockId.value }) };
});

const mockId = { value: '' };

// Importado después del mock, que fija el id.
const PersonRoute = require('../../src/app/person/[id]').default;

beforeEach(() => {
  resetRepositories();
  resetRouter();
});

it('pinta la ficha de esa persona, con sus redes', async () => {
  const [someone] = await repositories.profiles.list();
  mockId.value = someone.id;

  await renderRoute(<PersonRoute />);

  await waitFor(() => expect(screen.getByText(someone.name)).toBeTruthy());
  expect(screen.getByText(`${someone.age} · ${someone.location}`)).toBeTruthy();
});

it('si ya no existe lo dice, en vez de una pantalla vacía', async () => {
  mockId.value = 'no-existe';

  await renderRoute(<PersonRoute />);

  expect(await screen.findByText('Este perfil ya no está disponible')).toBeTruthy();
});

it('con un bloqueo de por medio no enseña la ficha', async () => {
  await repositories.session.setActiveMode('par');
  await repositories.profiles.saveCurrent(buildProfileInput());
  const [someone] = await repositories.profiles.list();
  await repositories.profiles.block(someone.id);
  mockId.value = someone.id;

  await renderRoute(<PersonRoute />);

  expect(await screen.findByText('Este perfil ya no está disponible')).toBeTruthy();
  expect(screen.queryByText(someone.name)).toBeNull();
});
