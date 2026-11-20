import { createMockRepositories, createMockStore } from './index';
import { buildProfileInput } from '../test-fixtures';
import { mockProjectPushDeliveries } from './project-notifications';

const me = 'me';
const peer = 'seed-nuria';
const myToken = 'ExponentPushToken[my_device]';
const peerToken = 'ExponentPushToken[peer_device]';
const thirdToken = 'ExponentPushToken[third_device]';
const minute = 60_000;

async function setup() {
  const store = createMockStore();
  const first = createMockRepositories(store);
  const second = createMockRepositories(store, { actorId: peer });
  const other = createMockRepositories(store, { actorId: 'seed-lucia' });
  await first.profiles.saveCurrent(buildProfileInput());
  const { match } = await first.discovery.recordDecision(peer, 'like');
  const id = match!.id;
  await first.push.register(myToken, 'ios');
  await second.push.register(peerToken, 'android');
  await other.push.register(thirdToken, 'android');
  await first.projects.save(
    {
      name: 'Mapa',
      tagline: 'Un mapa',
      link: '',
      description: '',
      cover: null,
      photos: [],
    },
    undefined,
    'project',
    id
  );
  const project = async () => (await first.projects.workspace(id))!.project;
  return {
    store,
    first,
    second,
    project,
    scope: { kind: 'match' as const, id },
    deliveries: (kind: string) =>
      mockProjectPushDeliveries(store)
        .filter((d) => d.kind === kind)
        .map((d) => d.recipient),
  };
}

it('avisa de creación, propuesta y eliminación al otro autor según sus preferencias', async () => {
  const { store, first, second, project, deliveries } = await setup();
  expect(deliveries('created')).toEqual([peer]);
  await second.push.setPreferences({ notify_messages: false });
  await first.projects.publication(await project(), 'propose');
  expect(deliveries('proposed')).toEqual([]);
  await second.projects.publication(await project(), 'reject');
  await second.push.setPreferences({ notify_messages: true });
  store.advanceClock(minute);
  expect(deliveries('proposed')).toEqual([]);
  await first.projects.publication(await project(), 'propose');
  store.advanceClock(minute);
  expect(deliveries('proposed')).toEqual([peer]);
  await second.projects.remove(await project());
  expect(deliveries('deleted')).toEqual([me]);
  expect(deliveries('created')).toEqual([peer]);
});

it('entrega recordatorios por responsable y fecha, omite tareas hechas y reuniones canceladas o bloqueadas', async () => {
  const { store, first, second, scope, deliveries } = await setup();
  const at = (minutes: number) => new Date(store.nowMs() + minutes * minute).toISOString();
  const dueAt = at(24 * 60 + 6);
  const task = {
    id: 'task',
    title: 'Boceto',
    dueAt,
    startsAt: null,
    place: null,
    assigneeId: peer,
  };
  const meeting = { id: 'meeting', title: 'Revisar el mapa', startsAt: at(20), place: null };
  await first.chatPlan.add(scope, task);
  await second.chatPlan.add(scope, meeting);
  expect(deliveries('task')).toEqual([]);
  expect(deliveries('meeting')).toEqual([]);
  await first.push.setPreferences({ notify_reminders: false });
  await first.chatPlan.setClosed(scope, meeting.id, true);
  store.advanceClock(7 * minute);
  expect(deliveries('meeting')).toEqual([]);
  expect(deliveries('task')).toEqual([peer]);
  await first.chatPlan.setClosed(scope, meeting.id, false);
  expect(deliveries('meeting')).toEqual([peer]);
  await first.push.setPreferences({ notify_reminders: true });
  store.advanceClock(minute);
  expect(deliveries('meeting')).toEqual([peer, me]);
  const newDeadline = at(60);
  await first.chatPlan.updateTask(scope, task.id, {
    dueAt: newDeadline,
    status: 'done',
    assigneeId: null,
  });
  store.advanceClock(minute);
  expect(deliveries('task')).toEqual([peer]);
  await second.chatPlan.setClosed(scope, task.id, false);
  expect(deliveries('task')).toEqual([peer, me, peer]);
  await first.chatPlan.add(scope, { ...meeting, id: 'late', startsAt: at(16) });
  await first.profiles.block(peer);
  store.advanceClock(2 * minute);
  expect(deliveries('meeting')).toEqual([peer, me]);
  store.reset();
  expect(mockProjectPushDeliveries(store)).toEqual([]);
});
