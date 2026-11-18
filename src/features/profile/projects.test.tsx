import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DataProvider, ProjectPhotoError } from '@/data';
import { createMockRepositories, createMockStore } from '@/data/mock';
import { buildProfileInput } from '@/data/test-fixtures';
import { MyProjects, ProjectStep, PublicProjects } from './projects';
import { pickAvatarPhoto } from './avatar-photo';

jest.mock('./avatar-photo', () => ({ pickAvatarPhoto: jest.fn() }));

async function openProjectStep(names: string[] = []) {
  const repo = createMockRepositories(createMockStore());
  const me = await repo.profiles.saveCurrent(buildProfileInput());
  for (const name of names) {
    await repo.projects.save({
      name,
      tagline: 'Frase de ' + name,
      description: '',
      link: '',
      cover: null,
      photos: [],
    });
  }
  const onContinue = jest.fn();
  await render(
    <DataProvider value={repo}>
      <ProjectStep
        ownerId={me.id}
        step={15}
        total={15}
        onBack={jest.fn()}
        onContinue={onContinue}
      />
    </DataProvider>
  );
  return { repo, me, onContinue };
}

it('sin proyectos permite crear el primero o avanzar con Ahora no', async () => {
  const { onContinue } = await openProjectStep();
  expect(await screen.findByRole('button', { name: 'Crear proyecto' })).toBeOnTheScreen();
  expect(screen.getByText('Enséñale a la gente lo que has construido')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Omitir' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Continuar' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Ahora no' }));
  expect(onContinue).toHaveBeenCalledTimes(1);
});

it.each([
  ['hay proyectos', ['Atlas', 'Mapa']],
  ['se llega al límite', ['Atlas', 'Mapa', 'Rutas']],
] as const)('cuando %s muestra las tarjetas en orden y permite continuar', async (_case, names) => {
  const { onContinue } = await openProjectStep([...names]);
  await screen.findByRole('button', { name: 'Editar Atlas' });
  const cards = screen
    .getAllByRole('button')
    .map((button) => button.props.accessibilityLabel)
    .filter((name: string | undefined) => name?.startsWith('Editar ') || name === 'Crear proyecto');
  const expected = names.map((name) => 'Editar ' + name);
  if (names.length < 3) expected.push('Crear proyecto');
  expect(cards).toEqual(expected);
  for (const name of names) expect(screen.getByText('Frase de ' + name)).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Omitir' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Ahora no' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
  expect(onContinue).toHaveBeenCalledTimes(1);
});

it('la X permite salir en blanco y protege los cambios hasta confirmar el descarte', async () => {
  const { repo, me } = await openProjectStep();
  await fireEvent.press(await screen.findByRole('button', { name: 'Crear proyecto' }));
  expect(screen.getByRole('button', { name: 'Guardar proyecto' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
  expect(screen.queryByLabelText('Nombre del proyecto')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Crear proyecto' }));
  await fireEvent.changeText(screen.getByLabelText('Nombre del proyecto'), 'Mapa');
  expect(screen.getByRole('button', { name: 'Guardar proyecto' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Frase corta'), 'Rutas de barrio');
  expect(screen.getByRole('button', { name: 'Guardar proyecto' })).toBeEnabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
  expect(screen.getByText('¿Descartar los cambios de este proyecto?')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Seguir editando' }));
  expect(screen.getByLabelText('Nombre del proyecto')).toHaveDisplayValue('Mapa');
  await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Descartar cambios' }));
  expect(screen.queryByLabelText('Nombre del proyecto')).toBeNull();
  expect(await repo.projects.list(me.id)).toEqual([]);
});

it('conserva la edición y bloquea la revisión antigua mientras se relee la tarjeta', async () => {
  const { repo, me } = await openProjectStep(['Atlas']);
  await fireEvent.press(await screen.findByRole('button', { name: 'Editar Atlas' }));
  await fireEvent.changeText(screen.getByLabelText('Nombre del proyecto'), 'Mapa nuevo');

  const read = repo.projects.list.bind(repo.projects);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const reload = jest.spyOn(repo.projects, 'list').mockImplementationOnce(async (ownerId) => {
    await gate;
    return read(ownerId);
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar proyecto' }));
  await waitFor(() => expect(reload).toHaveBeenCalledWith(me.id));
  const card = screen.getByRole('button', { name: 'Editar Mapa nuevo' });
  expect(card).toBeDisabled();
  expect(screen.getByText('Mapa nuevo')).toBeOnTheScreen();
  await fireEvent.press(card);
  expect(screen.queryByLabelText('Nombre del proyecto')).toBeNull();

  await act(async () => release());
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Editar Mapa nuevo' })).toBeEnabled()
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Editar Mapa nuevo' }));
  expect(screen.getByLabelText('Nombre del proyecto')).toHaveDisplayValue('Mapa nuevo');
  await fireEvent.changeText(screen.getByLabelText('Frase corta'), 'Segunda edición');
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar proyecto' }));
  await expect(read(me.id)).resolves.toMatchObject([
    { name: 'Mapa nuevo', tagline: 'Segunda edición' },
  ]);
});

it('el editor del alta publica la ficha completa y la tarjeta abre su edición en Perfil', async () => {
  const store = createMockStore();
  const repo = createMockRepositories(store);
  const me = await repo.profiles.saveCurrent(buildProfileInput());
  const view = await render(
    <DataProvider value={repo}>
      <ProjectStep ownerId={me.id} step={15} total={15} onBack={jest.fn()} onContinue={jest.fn()} />
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
  expect(await screen.findByRole('button', { name: 'Continuar' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Crear proyecto' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Ahora no' })).toBeNull();
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
