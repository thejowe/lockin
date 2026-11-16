import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { DataProvider } from '@/data';
import { createMockRepositories } from '@/data/mock';
import { pushPermission } from '@/lib/push';

import { NotificationPreferences, NotificationSection } from './notification-section';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useFocusEffect: (fn: () => void) => jest.requireActual('react').useEffect(fn, [fn]),
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/lib/push', () => ({ pushPermission: jest.fn(() => Promise.resolve('denied')) }));

it('ofrece siete interruptores, guarda el cambio y abre ajustes sin diálogo de permiso', async () => {
  const repositories = createMockRepositories();
  const save = jest.spyOn(repositories.push, 'setPreferences');
  const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  await render(
    <DataProvider value={repositories}>
      <NotificationPreferences />
    </DataProvider>
  );
  await waitFor(() => expect(screen.getAllByRole('switch')).toHaveLength(7));
  await fireEvent(screen.getByRole('switch', { name: 'Likes' }), 'valueChange', false);
  await waitFor(() =>
    expect(screen.getByRole('switch', { name: 'Likes' }).props.value).toBe(false)
  );
  expect(save).toHaveBeenCalledWith({ notify_likes: false });
  await fireEvent.press(screen.getByRole('button', { name: 'Abrir ajustes del sistema' }));
  expect(open).toHaveBeenCalled();
  expect(pushPermission).toHaveBeenCalled();
  open.mockRestore();
});

it('un error al guardar conserva la preferencia y permite reintentar', async () => {
  const repositories = createMockRepositories();
  jest.spyOn(repositories.push, 'setPreferences').mockRejectedValueOnce(new Error('offline'));
  await render(
    <DataProvider value={repositories}>
      <NotificationPreferences />
    </DataProvider>
  );
  await waitFor(() => expect(screen.getAllByRole('switch')).toHaveLength(7));
  await fireEvent(screen.getByRole('switch', { name: 'Recordatorios' }), 'valueChange', false);
  expect(
    await screen.findByText('No se han podido guardar las preferencias. Inténtalo de nuevo.')
  ).toBeTruthy();
  expect(screen.getByRole('switch', { name: 'Recordatorios' }).props.value).toBe(true);
});

it('Ajustes solo enseña «Gestionar notificaciones», que abre la pantalla de interruptores', async () => {
  await render(
    <DataProvider value={createMockRepositories()}>
      <NotificationSection />
    </DataProvider>
  );
  expect(screen.queryAllByRole('switch')).toHaveLength(0);
  await fireEvent.press(screen.getByRole('button', { name: 'Gestionar notificaciones' }));
  expect(mockPush).toHaveBeenCalledWith('/notifications');
});

it('un interruptor activado lleva la bola oscura para no fundirse con la pista blanca', async () => {
  await render(
    <DataProvider value={createMockRepositories()}>
      <NotificationPreferences />
    </DataProvider>
  );
  const likes = await screen.findByRole('switch', { name: 'Matches' });
  expect(likes.props.value).toBe(true);
  expect(likes.props.thumbTintColor ?? likes.props.thumbColor).not.toBe(
    likes.props.onTintColor ?? likes.props.trackColor?.true
  );
});
