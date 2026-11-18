/**
 * El tablón personal contra el mock (2026-10-17): añadir con pie, ver en
 * grande, quitar, el tope de fotos y que un bloqueo lo esconde.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import {
  BOARD_MAX_POSTS,
  BoardRejectedError,
  DataProvider,
  type BoardPost,
  type Profile,
  type Repositories,
} from '@/data';
import { createMockRepositories, resetState } from '@/data/mock';
import { buildProfileInput } from '@/data/test-fixtures';

import { Board } from './board';

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

async function renderBoard(ownerId = me.id, editable = true, onPhotoAdded?: (id: string) => void) {
  await render(
    <DataProvider value={repositories}>
      <Board ownerId={ownerId} ownerName="Ana" editable={editable} onPhotoAdded={onPhotoAdded} />
    </DataProvider>
  );
  await act(async () => {});
}

it('muestra dos filas vacías con una única acción en el primer hueco', async () => {
  await renderBoard();
  expect(screen.getAllByTestId(/^board-slot-/)).toHaveLength(4);
  const first = within(screen.getByTestId('board-slot-0'));
  expect(first.getByText('+')).toBeVisible();
  expect(first.getByText('Añadir foto')).toBeVisible();
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(screen.queryAllByTestId(/^board-pin-/)).toHaveLength(0);
});

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

it('espera la revisión y monta la foto en el hueco elegido con movimiento reducido', async () => {
  const reduced = jest.mocked(AccessibilityInfo.isReduceMotionEnabled);
  reduced.mockClear();
  await reduced.withImplementation(
    async () => true,
    async () => {
      const first = await repositories.profiles.addBoardPost('file:///a.jpg', 'Taller');
      const onPhotoAdded = jest.fn();
      await renderBoard(me.id, true, onPhotoAdded);
      expect(onPhotoAdded).not.toHaveBeenCalled();
      const add = within(screen.getByTestId('board-slot-1')).getByRole('button');
      await fireEvent.press(add);
      expect(reduced).toHaveBeenCalled();

      // Mantiene primero la moderación y luego la relectura de URLs en vuelo.
      let approve!: (post: BoardPost) => void;
      let reload!: (posts: BoardPost[]) => void;
      jest.spyOn(repositories.profiles, 'addBoardPost').mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            approve = resolve;
          })
      );
      jest.spyOn(repositories.profiles, 'listBoard').mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            reload = resolve;
          })
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Publicar en Sobre mí' }));
      expect(screen.getByRole('progressbar', { name: 'En revisión…' })).toBeVisible();
      // Cerrar la hoja durante la revisión no descarta la subida.
      await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
      expect(screen.getByRole('progressbar', { name: 'En revisión…' })).toBeVisible();
      expect(onPhotoAdded).not.toHaveBeenCalled();

      const second = { ...first, id: 'segunda', caption: 'Cuaderno', imageUrl: 'file:///b.jpg' };
      await act(() => approve(second));
      const slot = within(screen.getByTestId('board-slot-1'));
      // La caída espera a que la imagen (URL firmada en Supabase) se pinte.
      expect(slot.getByTestId('board-pin-segunda')).not.toBeVisible();
      await fireEvent(slot.getByTestId('board-image-segunda'), 'load', { nativeEvent: {} });
      expect(slot.getByTestId('board-photo-segunda')).toHaveStyle({
        transform: [{ rotate: '3deg' }],
      });
      expect(slot.getByTestId('board-pin-segunda')).toBeVisible();
      expect(onPhotoAdded).toHaveBeenCalledWith('segunda');
      await act(() => reload([second, first]));
      expect(
        within(screen.getByTestId('board-slot-0')).getByTestId(`board-photo-${first.id}`)
      ).toBeVisible();
      expect(onPhotoAdded).toHaveBeenCalledTimes(1);
    }
  );
});

it.each(['flagged', 'unavailable'] as const)(
  'con %s conserva el borrador y permite reintentar',
  async (reason) => {
    const onPhotoAdded = jest.fn();
    await renderBoard(me.id, true, onPhotoAdded);
    const rejection = new BoardRejectedError(reason);
    jest.spyOn(repositories.profiles, 'addBoardPost').mockRejectedValueOnce(rejection);
    await fireEvent.press(screen.getByText('Añadir foto'));
    await fireEvent.changeText(screen.getByLabelText('Texto de la foto'), 'Mi cuaderno');
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar en Sobre mí' }));
    expect(screen.getByRole('alert')).toHaveTextContent(rejection.message);
    expect(screen.getByDisplayValue('Mi cuaderno')).toBeVisible();
    expect(onPhotoAdded).not.toHaveBeenCalled();
    await expect(repositories.profiles.listBoard(me.id)).resolves.toHaveLength(0);

    await fireEvent.press(screen.getByRole('button', { name: 'Publicar en Sobre mí' }));
    const published = await screen.findByRole('imagebutton', { name: 'Mi cuaderno' });
    await fireEvent(within(published).getByTestId(/^board-image-/), 'load', { nativeEvent: {} });
    expect(published).toBeVisible();
    expect(onPhotoAdded).toHaveBeenCalledTimes(1);
  }
);

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

it('en solo lectura se puede ampliar una foto sin ofrecer huecos editables', async () => {
  const post = await repositories.profiles.addBoardPost('file:///foto.jpg', 'Taller');
  await renderBoard(me.id, false);
  expect(screen.getAllByTestId(/^board-slot-/)).toHaveLength(1);
  expect(screen.queryByText('Añadir foto')).toBeNull();
  await fireEvent.press(screen.getByTestId(`board-photo-${post.id}`));
  expect(screen.getByText('Taller')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Quitar esta foto' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
  expect(screen.getByTestId(`board-pin-${post.id}`)).toBeVisible();
});
