import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DataProvider } from '@/data';
import { createMockRepositories, resetState } from '@/data/mock';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';
import { buildProfileInput } from '@/data/test-fixtures';

import { RoomsSection } from './rooms-section';

import type { Repositories } from '@/data';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (effect: () => void) =>
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));

const NOW = new Date(2026, 9, 3, 10, 0).getTime();
let repositories: Repositories;

async function seedMatches(count: number) {
  await repositories.profiles.saveCurrent(buildProfileInput());
  for (const id of SEED_RECIPROCAL_IDS.slice(0, count)) {
    await repositories.discovery.recordDecision(id, 'like');
  }
}

function renderSection() {
  return render(
    <DataProvider value={repositories}>
      <RoomsSection />
    </DataProvider>
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  mockPush.mockClear();
  // Los repositorios del mock son siempre los mismos objetos: un espía sobrevive al test.
  jest.restoreAllMocks();
  resetState();
  repositories = createMockRepositories();
});
afterEach(() => {
  jest.useRealTimers();
});

it('sin salas y con un solo match no pinta nada', async () => {
  await seedMatches(1);
  const listLive = jest.spyOn(repositories.rooms, 'listLive');

  await renderSection();

  await waitFor(() => expect(listLive).toHaveBeenCalled());
  expect(screen.toJSON()).toBeNull();
});

it('sin matches ni salas no pinta nada', async () => {
  await renderSection();

  await waitFor(() => expect(screen.toJSON()).toBeNull());
});

it('con 2 matches ofrece convocar y lleva a /room/new', async () => {
  await seedMatches(2);

  await renderSection();

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Convocar sala Lock-In' })).toBeTruthy()
  );
  expect(screen.getByText('Salas Lock-In')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Convocar sala Lock-In' }));
  expect(mockPush).toHaveBeenCalledWith('/room/new');
});

it('pinta una fila por sala viva que lleva a la sala', async () => {
  await seedMatches(2);
  const view = await repositories.rooms.create({
    inviteeIds: SEED_RECIPROCAL_IDS.slice(0, 2),
    startsAt: new Date(NOW + 60 * 60_000).toISOString(),
    blocks: 2,
  });

  await renderSection();

  await waitFor(() => expect(screen.getByText('Tu sala')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: /^Tu sala · / }));
  expect(mockPush).toHaveBeenCalledWith(`/room/${view.room.id}`);
});

it('si las salas no cargan lo dice, aunque no puedas convocar, y deja reintentar', async () => {
  await seedMatches(1);
  const listLive = jest
    .spyOn(repositories.rooms, 'listLive')
    .mockRejectedValueOnce(new Error('sin red'));

  await renderSection();

  await waitFor(() => expect(screen.getByText('No hemos podido cargar tus salas.')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));

  await waitFor(() => expect(listLive).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.toJSON()).toBeNull());
});

it('una invitación se ve aunque ya no queden 2 matches para convocar', async () => {
  await seedMatches(2);
  await repositories.rooms.create({
    inviteeIds: SEED_RECIPROCAL_IDS.slice(0, 2),
    startsAt: new Date(NOW + 60 * 60_000).toISOString(),
    blocks: 1,
  });
  jest.spyOn(repositories.matches, 'list').mockResolvedValue([]);

  await renderSection();

  await waitFor(() => expect(screen.getByText('Tu sala')).toBeTruthy());
  expect(screen.queryByRole('button', { name: 'Convocar sala Lock-In' })).toBeNull();
});
