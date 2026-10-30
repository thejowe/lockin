/**
 * La ruta `/likes`: monta la cuadrícula y, al hacer match desde ella, abre el chat.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { setMockPremium } from '@/data/mock';
import { SEED_RECIPROCAL_IDS } from '@/data/mock/seed';
import { buildProfileInput } from '@/data/test-fixtures';

import { renderRoute, repositories, resetRepositories, resetRouter, router } from '../routes';

import LikesRoute from '../../src/app/likes';

jest.mock('expo-router', () => require('../routes').expoRouterMock());

beforeEach(async () => {
  resetRepositories();
  resetRouter();
  await repositories.profiles.saveCurrent(buildProfileInput());
});

describe('LikesRoute', () => {
  it('sin Premium pinta el relleno y el botón de Premium', async () => {
    await renderRoute(<LikesRoute />);

    await waitFor(() => expect(screen.getByText('Hazte Premium')).toBeTruthy());
  });

  it('un match desde la cuadrícula abre su chat', async () => {
    setMockPremium(true);
    await renderRoute(<LikesRoute />);
    const profile = (await repositories.profiles.getById(SEED_RECIPROCAL_IDS[0]))!;
    await waitFor(() => expect(screen.getByText(profile.name)).toBeTruthy());

    await fireEvent.press(screen.getByText(profile.name));
    await fireEvent.press(screen.getByText('Me gusta'));
    await waitFor(() => expect(screen.getByText('Abrir chat')).toBeTruthy());
    await fireEvent.press(screen.getByText('Abrir chat'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/chat/[matchId]',
      params: { matchId: expect.any(String) },
    });
  });
});
