import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DataProvider, ProjectPhotoError } from '@/data';
import { createMockRepositories, createMockStore } from '@/data/mock';
import { buildProfileInput } from '@/data/test-fixtures';
import { MyProjects, PublicProjects } from './projects';
import { pickAvatarPhoto } from './avatar-photo';

jest.mock('./avatar-photo', () => ({ pickAvatarPhoto: jest.fn() }));

it('el editor del alta publica la ficha completa y el mismo cuadrado abre su edición en Perfil', async () => {
  const store = createMockStore();
  const repo = createMockRepositories(store);
  const me = await repo.profiles.saveCurrent(buildProfileInput());
  const view = await render(
    <DataProvider value={repo}>
      <MyProjects ownerId={me.id} wizard />
    </DataProvider>
  );
  await fireEvent.press(await screen.findByRole('button', { name: 'Crear proyecto' }));
  expect(screen.queryByLabelText('Descripción')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Nombre del proyecto'), 'Mapa');
  await fireEvent.changeText(screen.getByLabelText('Frase corta'), 'Rutas de barrio');
  await fireEvent.press(screen.getByRole('button', { name: 'Más detalles' }));
  await fireEvent.changeText(screen.getByLabelText('Descripción'), 'Galería de rutas');
  jest.mocked(pickAvatarPhoto).mockResolvedValue({ status: 'picked', uri: 'file:///foto.jpg' });
  await fireEvent.press(screen.getByRole('button', { name: 'Añadir foto (0/5)' }));
  await waitFor(() => expect(screen.getByText('Foto 1')).toBeTruthy());
  const save = jest
    .spyOn(repo.projects, 'save')
    .mockRejectedValueOnce(new ProjectPhotoError(1, true));
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar proyecto' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Esta foto se ha rechazado. Elige otra.');
  expect(await repo.projects.list(me.id)).toEqual([]);
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar proyecto' }));
  await screen.findByRole('button', { name: 'Editar Mapa' });
  expect(save).toHaveBeenCalledTimes(2);
  await view.rerender(
    <DataProvider value={repo}>
      <PublicProjects ownerId={me.id} />
    </DataProvider>
  );
  expect(await screen.findByText('Galería de rutas')).toBeTruthy();
  await fireEvent.press(screen.getByRole('imagebutton', { name: 'Ampliar foto 1' }));
  expect(screen.getByRole('button', { name: 'Cerrar' })).toBeTruthy();
  await view.rerender(
    <DataProvider value={repo}>
      <MyProjects ownerId={me.id} />
    </DataProvider>
  );
  await fireEvent.press(await screen.findByRole('button', { name: 'Editar Mapa' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Eliminar proyecto' }));
  expect(await repo.projects.list(me.id)).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmar eliminación' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Editar Mapa' })).toBeNull());
});
