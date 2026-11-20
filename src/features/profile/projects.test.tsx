import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
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
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Esta foto se ha rechazado. Elige otra.'
  );
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

it('el último autor puede publicar u ocultar su proyecto separado, y reintentar si falla', async () => {
  const store = createMockStore();
  const repo = createMockRepositories(store);
  const me = await repo.profiles.saveCurrent(buildProfileInput());
  await repo.projects.save(
    { name: 'Taller', tagline: 'Rutas', link: '', description: '', cover: null, photos: [] },
    undefined,
    'p'
  );
  store.state.jointProjects.set('p', {
    detached: true,
    matchId: null,
    authorIds: [me.id],
    published: false,
    proposedBy: null,
    notes: '',
    notesBy: null,
    notesRevision: 'notes',
  });
  await render(
    <DataProvider value={repo}>
      <MyProjects ownerId={me.id} />
    </DataProvider>
  );
  await fireEvent.press(await screen.findByRole('button', { name: 'Editar Taller, privado' }));
  const toggle = screen.getByTestId('detached-publish-switch');
  expect(toggle.props.value).toBe(false);
  const publication = jest
    .spyOn(repo.projects, 'publication')
    .mockRejectedValueOnce(new Error('Sin conexión'));
  await fireEvent(toggle, 'valueChange', true);
  expect(await screen.findByText('Sin conexión')).toBeOnTheScreen();
  await fireEvent(toggle, 'valueChange', true);
  await fireEvent.press(await screen.findByRole('button', { name: 'Editar Taller' }));
  expect(screen.getByTestId('detached-publish-switch').props.value).toBe(true);
  await fireEvent(screen.getByTestId('detached-publish-switch'), 'valueChange', false);
  expect(await screen.findByRole('button', { name: 'Editar Taller, privado' })).toBeOnTheScreen();
  expect(publication.mock.calls.map(([, action]) => action)).toEqual([
    'publish',
    'publish',
    'private',
  ]);
});

it('después de guardar dos fichas permite ordenar, quitar fotos de la galería y descartar cambios', async () => {
  const store = createMockStore();
  const repo = createMockRepositories(store);
  const me = await repo.profiles.saveCurrent(buildProfileInput());
  const input = {
    name: 'Primero',
    tagline: 'Rutas',
    description: '',
    link: '',
    cover: null,
    photos: [],
  };
  await repo.projects.save(input);
  await repo.projects.save({
    ...input,
    name: 'Segundo',
    cover: { uri: 'file:///cover.jpg' },
    photos: [{ uri: 'file:///a.jpg' }],
  });
  await render(
    <DataProvider value={repo}>
      <MyProjects ownerId={me.id} />
    </DataProvider>
  );
  await fireEvent.press(await screen.findByRole('button', { name: 'Editar Segundo' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Mover al principio' }));
  await waitFor(async () => expect((await repo.projects.list(me.id))[0].name).toBe('Segundo'));
  await fireEvent.press(await screen.findByRole('button', { name: 'Editar Segundo' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Quitar esta foto' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Más detalles' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Quitar esta foto' }));
  expect(screen.queryByText('Foto 1')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Eliminar proyecto' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Conservar proyecto' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
  const [saved] = await repo.projects.list(me.id);
  expect(saved.cover).toBeTruthy();
  expect(saved.photos).toHaveLength(1);
});

it('la ficha pública admite reintentar la lectura, cerrar la galería y recuperarse si el enlace no abre', async () => {
  const repo = createMockRepositories(createMockStore());
  const me = await repo.profiles.saveCurrent(buildProfileInput());
  await repo.projects.save({
    name: 'Ficha',
    tagline: 'Un mapa',
    description: '',
    link: 'https://example.org/',
    cover: null,
    photos: [{ uri: 'file:///a.jpg' }],
  });
  jest.spyOn(repo.projects, 'list').mockRejectedValueOnce(new Error('offline'));
  const open = jest
    .spyOn(Linking, 'openURL')
    .mockRejectedValueOnce(new Error('falló'))
    .mockResolvedValue(undefined);
  try {
    await render(
      <DataProvider value={repo}>
        <PublicProjects ownerId={me.id} />
      </DataProvider>
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Volver a cargar proyectos' }));
    await fireEvent.press(await screen.findByRole('imagebutton', { name: 'Ampliar foto 1' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
    const link = screen.getByRole('link');
    await fireEvent.press(link);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido abrir el enlace.');
    await fireEvent.press(link);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(open).toHaveBeenLastCalledWith('https://example.org/');
  } finally {
    open.mockRestore();
  }
});
