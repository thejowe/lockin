import { fireEvent, render, screen } from '@testing-library/react-native';

import { DataProvider } from '@/data';
import {
  CURRENT_USER_ID,
  createMockAgreementRepository,
  createMockRepositories,
  resetState,
} from '@/data/mock';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';
import { buildProfileInput } from '@/data/test-fixtures';

import { AgreementCard } from './agreement-card';

import type { MatchWithProfile, Repositories } from '@/data';

const mockRouter = { push: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, [effect]),
}));

const NURIA = SEED_RECIPROCAL_IDS[0];
let repositories: Repositories;
let match: MatchWithProfile;

beforeEach(async () => {
  mockRouter.push.mockClear();
  resetState();
  repositories = createMockRepositories();
  await repositories.profiles.saveCurrent(buildProfileInput({ lookingFor: 'par' }));
  const { match: created } = await repositories.discovery.recordDecision(NURIA, 'like');
  match = (await repositories.matches.getById(created!.id))!;
});

const renderCard = (value: MatchWithProfile = match) =>
  render(
    <DataProvider value={repositories}>
      <AgreementCard match={value} />
    </DataProvider>
  );

it('sin respuestas mías: invita y dice cuántas lleva ella por delante', async () => {
  await renderCard();
  expect(await screen.findByText('Acuerdo de socios')).toBeTruthy();
  expect(
    screen.getByText('8 temas difíciles, a ciegas hasta que respondáis los dos.')
  ).toBeTruthy();
  expect(await screen.findByText('Núria Bosch ha respondido 3 que tú aún no.')).toBeTruthy();
});

it('con respuestas: recuento de comparados y distintos', async () => {
  const mine = createMockAgreementRepository(CURRENT_USER_ID);
  await mine.answer({ matchId: match.id, topic: 'dedicacion', option: 'completa' });
  await mine.answer({ matchId: match.id, topic: 'participacion', option: 'partes-iguales' });

  await renderCard();
  expect(await screen.findByText('2 de 8 comparados · 1 distinto')).toBeTruthy();
});

it('toda la tarjeta lleva a la pantalla del acuerdo', async () => {
  await renderCard();
  await fireEvent.press(await screen.findByRole('button', { name: /Acuerdo de socios/ }));
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: '/agreement/[matchId]',
    params: { matchId: match.id },
  });
});

it('en un match Lock-In no se pinta', async () => {
  await renderCard({ ...match, mode: 'lockin' });
  expect(screen.queryByText('Acuerdo de socios')).toBeNull();
});
