import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ChatScreen from '@/app/chat/[matchId]';
import { TERMS_VERSION } from '@/constants/legal';
import { DataProvider, type Repositories } from '@/data';
import { createMockRepositories, createMockStore } from '@/data/mock';
import { buildProfileInput } from '@/data/test-fixtures';
import { setSearchParams } from '../../../test/routes';

jest.mock('expo-router', () => {
  const router = jest.requireActual('../../../test/routes').expoRouterMock();
  router.Stack.Screen = function MockScreen({
    options,
  }: {
    options: { headerRight?: () => React.ReactNode };
  }) {
    return options.headerRight?.() ?? null;
  };
  return router;
});

async function setup() {
  const store = createMockStore();
  const first = createMockRepositories(store);
  const second = createMockRepositories(store, { actorId: 'seed-nuria' });
  const profile = await first.profiles.saveCurrent(buildProfileInput());
  await first.session.acceptTerms(TERMS_VERSION);
  await second.session.acceptTerms(TERMS_VERSION);
  const { match } = await first.discovery.recordDecision('seed-nuria', 'like');
  const id = match!.id;
  setSearchParams({ matchId: id });
  return { first, second, id, profile, scope: { kind: 'match' as const, id } };
}
function asUser(repo: Repositories) {
  return render(
    <DataProvider value={repo}>
      <ChatScreen />
    </DataProvider>
  );
}
async function press(label: string) {
  await fireEvent.press(await screen.findByRole('button', { name: label }));
}
async function tab(label: string) {
  await fireEvent.press(await screen.findByRole('tab', { name: label }));
}
async function createProject() {
  await press('Crear proyecto juntos');
  await fireEvent.changeText(screen.getByLabelText('Nombre del proyecto'), 'Atlas');
  await fireEvent.changeText(screen.getByLabelText('Frase corta'), 'Rutas accesibles');
  await press('Más detalles');
  await fireEvent.changeText(screen.getByLabelText('Descripción'), 'Un mapa entre los dos');
  await press('Guardar proyecto');
  await screen.findByRole('button', { name: 'Ver ficha de Atlas' });
}
const flickSwitch = (published: boolean) =>
  fireEvent(screen.getByLabelText('Publicar en los perfiles'), 'valueChange', published);

it('crea desde los icebreakers, mantiene el plan y abre la ficha solo al tocar la cabecera', async () => {
  const { first, second, id, scope } = await setup();
  await first.chatPlan.add(scope, {
    id: 'plan-1',
    title: 'Entrevistar a Ana',
    startsAt: null,
    place: null,
  });
  await first.chatPlan.add(scope, {
    id: 'plan-2',
    title: 'Repasar la ruta',
    startsAt: '2099-04-01T18:00:00.000Z',
    place: null,
  });
  const chat = await asUser(first);
  await createProject();
  expect(await screen.findByRole('tab', { name: 'Proyecto' })).toBeTruthy();
  expect(screen.getByText('Entrevistar a Ana')).toBeTruthy();
  expect(screen.getByText('Repasar la ruta')).toBeTruthy();
  expect(screen.queryByText('Rutas accesibles')).toBeNull();
  expect(screen.queryByText('Publicar en los perfiles')).toBeNull();
  await press('Ver ficha de Atlas');
  expect(screen.getByText('Un mapa entre los dos')).toBeTruthy();
  expect(screen.getByLabelText(/Autores:.*Núria Bosch/)).toBeTruthy();
  await press('Cerrar');
  expect(screen.queryByText('Un mapa entre los dos')).toBeNull();
  await fireEvent.changeText(
    screen.getByLabelText('Notas compartidas'),
    'Decidimos empezar en Girona.'
  );
  await press('Guardar notas');
  await screen.findByText('Has editado estas notas.');
  await chat.unmount();
  await asUser(second);
  await tab('Proyecto');
  expect(await screen.findByDisplayValue('Decidimos empezar en Girona.')).toBeTruthy();
  await press('Ver ficha de Atlas');
  await press('Editar proyecto');
  await fireEvent.changeText(screen.getByLabelText('Nombre del proyecto'), 'Atlas abierto');
  await press('Guardar proyecto');
  expect(await screen.findByRole('button', { name: 'Ver ficha de Atlas abierto' })).toBeTruthy();
  await press('Ver ficha de Atlas abierto');
  await press('Editar proyecto');
  await press('Eliminar proyecto');
  expect((await first.projects.workspace(id))?.project.name).toBe('Atlas abierto');
  await press('Confirmar eliminación');
  await screen.findByRole('tab', { name: 'Plan compartido' });
  expect(await screen.findByText('Entrevistar a Ana')).toBeTruthy();
  expect(await first.chatPlan.list(scope)).toHaveLength(2);
  await screen.unmount();
  await asUser(first);
  await screen.findByText('Núria Bosch ha eliminado el proyecto conjunto.');
});

it('pide los dos consentimientos, permite retirar la publicación y cierra el proyecto al bloquear', async () => {
  const { first, second, profile } = await setup();
  const firstView = await asUser(first);
  await tab('Plan compartido');
  await createProject();
  await press('Ver ficha de Atlas');
  await flickSwitch(true);
  await screen.findByText('Pendiente de la otra persona.');
  expect(screen.getByLabelText('Publicar en los perfiles')).toBeDisabled();
  await press('Retirar propuesta');
  await screen.findByText('Solo vosotros podéis ver esta ficha.');
  await flickSwitch(true);
  await screen.findByText('Pendiente de la otra persona.');
  expect((await first.projects.list(profile.id)).map((p) => p.name)).not.toContain('Atlas');
  await firstView.unmount();
  const secondView = await asUser(second);
  expect(await screen.findByText('¿Publicar en vuestros perfiles?')).toBeTruthy();
  await press('Aceptar publicación');
  await waitFor(async () =>
    expect((await first.projects.list(profile.id)).map((p) => p.name)).toContain('Atlas')
  );
  await tab('Proyecto');
  await press('Ver ficha de Atlas');
  await flickSwitch(false);
  await screen.findByText('Solo vosotros podéis ver esta ficha.');
  expect((await first.projects.list(profile.id)).map((p) => p.name)).not.toContain('Atlas');
  await flickSwitch(true);
  await screen.findByText('Pendiente de la otra persona.');
  await secondView.unmount();
  await asUser(first);
  await press('Aceptar publicación');
  await tab('Proyecto');
  await screen.findByText('Atlas');
  await press('Opciones de Núria Bosch');
  await press('Bloquear a Núria Bosch');
  await press('Confirmar bloqueo');
  await screen.findByText('Esta conversación no está disponible');
  expect(screen.queryByText('Atlas')).toBeNull();
  expect((await second.projects.list('seed-nuria')).map((p) => p.name)).not.toContain('Atlas');
});

it('asigna, filtra y actualiza tareas con fecha y evita perder notas de la otra persona', async () => {
  const { first, second, scope, id } = await setup();
  await asUser(first);
  await createProject();
  await press('Añadir tarea');
  await fireEvent.changeText(screen.getByLabelText('Nombre de la tarea'), 'Validar el prototipo');
  await fireEvent.press(screen.getByRole('radio', { name: 'Núria Bosch' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'En curso' }));
  await fireEvent.changeText(screen.getByLabelText('Fecha límite (opcional)'), '31022099');
  await press('Guardar');
  expect(await screen.findByText('Introduce una fecha válida (DD/MM/AAAA).')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Fecha límite (opcional)'), '15042099');
  await press('Guardar');
  await screen.findByText('Validar el prototipo');
  expect(await second.chatPlan.list(scope)).toEqual([
    expect.objectContaining({
      assigneeId: 'seed-nuria',
      status: 'in_progress',
      dueAt: new Date(2099, 3, 15, 23, 59).toISOString(),
    }),
  ]);
  await fireEvent.press(screen.getByRole('radio', { name: 'Yo' }));
  expect(screen.queryByText('Validar el prototipo')).toBeNull();
  await fireEvent.press(screen.getByRole('radio', { name: 'Núria Bosch' }));
  await fireEvent.press(screen.getByRole('button', { name: /Validar el prototipo/ }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Hecha' }));
  await press('Guardar');
  expect(await second.chatPlan.list(scope)).toEqual([
    expect.objectContaining({ closed: true, status: 'done' }),
  ]);
  await fireEvent.changeText(screen.getByLabelText('Notas compartidas'), 'Nuestro borrador local');
  const current = (await second.projects.workspace(id))!;
  await second.projects.saveNotes(current.project.id, 'Cambio de Núria', current.notesRevision);
  await press('Guardar notas');
  await screen.findByText('Cambio de Núria');
  expect(screen.getByDisplayValue('Nuestro borrador local')).toBeTruthy();
  await press('Usar su versión');
  expect(screen.getByDisplayValue('Cambio de Núria')).toBeTruthy();
});

it('avisa del cupo antes de aceptar y permite rechazar la propuesta', async () => {
  const { first, second, id } = await setup();
  const input = {
    name: 'Atlas',
    tagline: 'Un mapa compartido',
    description: '',
    photos: [],
    cover: null,
    link: '',
  };
  await first.projects.save(input, undefined, 'joint', id);
  const joint = (await first.projects.workspace(id))!;
  await first.projects.publication(joint.project, 'propose');
  while ((await second.projects.list('seed-nuria')).length < 3)
    await second.projects.save({ ...input, name: 'Proyecto individual' });
  await asUser(second);
  expect(
    await screen.findByText(
      'Hace falta un espacio libre en cada perfil. El máximo es de tres proyectos.'
    )
  ).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Aceptar publicación' })).toBeDisabled();
  await press('Rechazar');
  await waitFor(() => expect(screen.queryByText('¿Publicar en vuestros perfiles?')).toBeNull());
  expect((await first.projects.workspace(id))?.published).toBe(false);
});
