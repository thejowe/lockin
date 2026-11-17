import { fireEvent, screen } from '@testing-library/react-native';
import { uuid } from 'expo';

import ChatScreen from '@/app/chat/[matchId]';
import GroupChatScreen from '@/app/group/[groupId]';
import { TERMS_VERSION } from '@/constants/legal';
import { createMockRepositories, defaultMockStore } from '@/data/mock';
import { buildProfileInput } from '@/data/test-fixtures';
import { meetingInstant } from '@/features/chat/plan-form';
import { renderRoute, repositories, resetRepositories, setSearchParams } from '../routes';

jest.mock('expo-router', () => jest.requireActual('../routes').expoRouterMock());

it('conserva el borrador del chat y reintenta la misma tarea si se pierde la respuesta', async () => {
  resetRepositories();
  await repositories.profiles.saveCurrent(buildProfileInput());
  await repositories.session.acceptTerms(TERMS_VERSION);
  const { match } = await repositories.discovery.recordDecision('seed-nuria', 'like');
  const scope = { kind: 'match' as const, id: match!.id };
  setSearchParams({ matchId: scope.id });
  jest.spyOn(uuid, 'v4').mockReturnValue('00000000-0000-4000-8000-000000000001');
  const add = repositories.chatPlan.add;
  const save = jest.spyOn(repositories.chatPlan, 'add').mockImplementationOnce(async (...args) => {
    await add(...args);
    throw new Error('Respuesta perdida');
  });
  await renderRoute(<ChatScreen />);
  const message = await screen.findByPlaceholderText('Escribe a Núria');
  await fireEvent.changeText(message, 'Lo comentamos mañana');
  await fireEvent.press(screen.getByRole('tab', { name: 'Plan compartido' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Añadir tarea' }));
  await fireEvent.changeText(screen.getByLabelText('Nombre de la tarea'), 'Arreglar el puto bug');
  const submit = () => fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
  await submit();
  expect(await screen.findByRole('alert')).toBeTruthy();
  await submit();
  expect(save.mock.calls[0][1].id).toBe(save.mock.calls[1][1].id);
  const task = await screen.findByRole('checkbox', { name: 'Arreglar el puto bug' });
  await fireEvent.press(task);
  const peer = createMockRepositories(defaultMockStore, { actorId: 'seed-nuria' });
  expect(await peer.chatPlan.list(scope)).toEqual([expect.objectContaining({ closed: true })]);
  await fireEvent.press(screen.getByRole('tab', { name: 'Mensajes' }));
  expect(screen.getByDisplayValue('Lo comentamos mañana')).toBeTruthy();
});

it('convierte la hora local a UTC y rechaza fechas imposibles o pasadas', () => {
  expect(meetingInstant('29/02/2096', '10:45')).toBe(new Date(2096, 1, 29, 10, 45).toISOString());
  expect(meetingInstant('29/02/2097', '10:45')).toBeNull();
  expect(meetingInstant('28/02/2097', '24:00')).toBeNull();
  expect(meetingInstant('01/01/2000', '10:00')).toBeNull();
});

it('permite programar, cancelar y restablecer una reunión en el grupo', async () => {
  resetRepositories();
  await repositories.session.acceptTerms(TERMS_VERSION);
  await repositories.profiles.saveCurrent(buildProfileInput());
  const { group } = await repositories.groups.create({
    name: 'Equipo',
    description: 'Compartimos un proyecto de investigación.',
    roles: [{ specialty: 'dev', slots: 1 }],
  });
  setSearchParams({ groupId: group.id });
  jest.spyOn(uuid, 'v4').mockReturnValue('00000000-0000-4000-8000-000000000002');
  await renderRoute(<GroupChatScreen />);
  await fireEvent.press(await screen.findByRole('tab', { name: 'Plan compartido' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Programar reunión' }));
  await fireEvent.changeText(screen.getByLabelText('Tema de la reunión'), 'Revisar prototipo');
  await fireEvent.changeText(screen.getByLabelText('Fecha (DD/MM/AAAA)'), '30022096');
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Fecha (DD/MM/AAAA)'), '29022096');
  await fireEvent.changeText(screen.getByLabelText('Hora local (24 h)'), '1615');
  const place = 'https://example.com/reunion/puto-bug';
  await fireEvent.changeText(screen.getByLabelText('Lugar o enlace (opcional)'), place);
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
  expect(await screen.findByText(place)).toBeTruthy();
  const scope = { kind: 'group' as const, id: group.id };
  expect(await repositories.chatPlan.list(scope)).toEqual([
    expect.objectContaining({ startsAt: new Date(2096, 1, 29, 16, 15).toISOString() }),
  ]);
  await fireEvent.press(screen.getByRole('button', { name: 'Cancelar reunión' }));
  expect(await screen.findByText('Reunión cancelada')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Restablecer reunión' }));
  expect(await screen.findByRole('button', { name: 'Cancelar reunión' })).toBeTruthy();
});
