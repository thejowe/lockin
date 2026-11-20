/**
 * El tablón personal contra el mock (2026-10-17): añadir con pie, ver en
 * grande, quitar, el tope de fotos y que un bloqueo lo esconde.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { BOARD_MAX_POSTS, DataProvider } from '@/data';
import { createMockRepositories, resetState } from '@/data/mock';
import { buildProfileInput } from '@/data/test-fixtures';

import { Board } from './board';

import type { Profile, Repositories } from '@/data';

jest.mock('./avatar-photo', () => ({
  pickAvatarPhoto: jest.fn(() => Promise.resolve({ status: 'picked', uri: 'file:///foto.jpg' })),
}));

let repositories: Repositories;
let me: Profile;

beforeEach(async () => {
  resetState();
  repositories = createMockRepositories();
  await repositories.session.setActiveMode('par');
  me = await repositories.profiles.saveCurrent(buildProfileInput({ name: 'Ana' }));
});

async function renderBoard(ownerId = me.id, editable = true) {
  await render(
    <DataProvider value={repositories}>
      <Board ownerId={ownerId} ownerName="Ana" editable={editable} />
    </DataProvider>
  );
  await act(async () => {});
}

it('añade una foto con su pie y la enseña en el tablón', async () => {
  await renderBoard();

  await fireEvent.press(screen.getByRole('button', { name: 'Añadir una foto a Sobre mí' }));
  await fireEvent.changeText(screen.getByLabelText('Texto de la foto'), 'Mi primer prototipo');
  await fireEvent.press(screen.getByRole('button', { name: 'Publicar en Sobre mí' }));

  await waitFor(() =>
    expect(screen.getByRole('imagebutton', { name: 'Mi primer prototipo' })).toBeTruthy()
  );
  expect(await repositories.profiles.listBoard(me.id)).toHaveLength(1);
});

it('informa de permisos y conserva el borrador de una foto si la subida falla', async () => {
  const { pickAvatarPhoto } = jest.requireMock('./avatar-photo');
  pickAvatarPhoto.mockResolvedValueOnce({ status: 'denied' });
  await renderBoard();
  const add = screen.getByRole('button', { name: 'Añadir una foto a Sobre mí' });
  await fireEvent.press(add);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Sin permiso para tus fotos no podemos subir ninguna.'
  );
  await fireEvent.press(add);
  jest.spyOn(repositories.profiles, 'addBoardPost').mockRejectedValueOnce(new Error('Temporal'));
  await fireEvent.press(screen.getByRole('button', { name: 'Publicar en Sobre mí' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Temporal');
  const alert = jest.spyOn(Alert, 'alert');
  await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
  expect(alert).toHaveBeenCalledWith('¿Descartar los cambios?', undefined, expect.any(Array));
  await act(() =>
    alert.mock.lastCall?.[2]?.find((choice) => choice.style === 'destructive')?.onPress?.()
  );
  alert.mockRestore();
  expect(screen.queryByLabelText('Texto de la foto')).toBeNull();
});

it('una foto sin pie tiene etiqueta y sigue en el visor cuando falla el borrado', async () => {
  await repositories.profiles.addBoardPost('file:///a.jpg', '');
  await renderBoard();
  await fireEvent.press(screen.getByRole('imagebutton', { name: 'Foto personal de Ana' }));
  jest.spyOn(repositories.profiles, 'removeBoardPost').mockRejectedValueOnce(null);
  await fireEvent.press(screen.getByRole('button', { name: 'Quitar esta foto' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido quitar la foto.');
  await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
  expect(await repositories.profiles.listBoard(me.id)).toHaveLength(1);
});

it('al tocar una foto se ve en grande y se puede quitar', async () => {
  await repositories.profiles.addBoardPost('file:///a.jpg', 'Taller');
  await renderBoard();

  await fireEvent.press(screen.getByRole('imagebutton', { name: 'Taller' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Quitar esta foto' }));

  await waitFor(async () => expect(await repositories.profiles.listBoard(me.id)).toEqual([]));
});

it('un texto objetable no se manda', async () => {
  await renderBoard();
  const spy = jest.spyOn(repositories.profiles, 'addBoardPost');

  await fireEvent.press(screen.getByRole('button', { name: 'Añadir una foto a Sobre mí' }));
  await fireEvent.changeText(screen.getByLabelText('Texto de la foto'), 'puta');
  await fireEvent.press(screen.getByRole('button', { name: 'Publicar en Sobre mí' }));

  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(spy).not.toHaveBeenCalled();
});

it(`con ${BOARD_MAX_POSTS} fotos ya no ofrece añadir más`, async () => {
  for (let i = 0; i < BOARD_MAX_POSTS; i += 1) {
    await repositories.profiles.addBoardPost(`file:///${i}.jpg`, `Foto ${i}`);
  }
  await renderBoard();

  expect(screen.queryByRole('button', { name: 'Añadir una foto a Sobre mí' })).toBeNull();
  await expect(repositories.profiles.addBoardPost('file:///x.jpg', '')).rejects.toThrow(/ya tiene/);
});

it('el tablón ajeno vacío no ocupa sitio, y uno ajeno no se edita', async () => {
  const [other] = await repositories.profiles.list();
  await renderBoard(other.id, false);

  expect(screen.queryByText('Sobre mí')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Añadir una foto a Sobre mí' })).toBeNull();
});

it('con un bloqueo, el tablón del otro no se lista', async () => {
  const [other] = await repositories.profiles.list();
  await repositories.profiles.addBoardPost('file:///mia.jpg', '');
  await repositories.profiles.block(other.id);

  expect(await repositories.profiles.listBoard(other.id)).toEqual([]);
});
