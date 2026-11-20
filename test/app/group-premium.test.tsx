/**
 * Crear grupo con `GROUP_CREATION_REQUIRES_PREMIUM` encendido. Hoy el flag está
 * apagado; este archivo lo enciende para que el día que se cobre no haya que
 * descubrir entonces si la puerta funciona.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { buildProfileInput } from '@/data/test-fixtures';
import { GroupsSection } from '@/features/groups';

import { renderRoute, repositories, resetRepositories, resetRouter, router } from '../routes';

import NewGroupRoute from '../../src/app/group/new';

import type { PremiumQuotas } from '@/data';

jest.mock('expo-router', () => jest.requireActual('../routes').expoRouterMock());
jest.mock('@/data/groups', () => ({
  ...jest.requireActual('@/data/groups'),
  GROUP_CREATION_REQUIRES_PREMIUM: true,
}));

async function asPremium(isPremium: boolean) {
  const quotas = await repositories.premium.getQuotas();
  jest
    .spyOn(repositories.premium, 'getQuotas')
    .mockResolvedValue({ ...quotas, isPremium } as PremiumQuotas);
}

beforeEach(async () => {
  jest.restoreAllMocks();
  resetRepositories();
  resetRouter();
  await repositories.profiles.saveCurrent(buildProfileInput({ name: 'Yo', specialties: ['dev'] }));
});

describe('crear grupo de pago', () => {
  it('sin Premium, /group/new se cierra y abre el paywall', async () => {
    await asPremium(false);
    await renderRoute(<NewGroupRoute />);

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/premium'));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Nombre del grupo')).toBeNull();
  });

  it('con Premium, /group/new enseña el formulario', async () => {
    await asPremium(true);
    await renderRoute(<NewGroupRoute />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Buscar gente' }));
    expect(screen.getByLabelText('Nombre del grupo')).toBeTruthy();
    expect(router.push).not.toHaveBeenCalledWith('/premium');
  });

  it.each([
    [false, '/premium', '/group/new'],
    [true, '/group/new', '/premium'],
  ])('desde el deck, «Crear grupo» con Premium=%s lleva a %s', async (isPremium, to, never) => {
    await repositories.profiles.saveCurrent(
      buildProfileInput({ name: 'Yo', specialties: ['legal'] })
    );
    await asPremium(isPremium);
    await renderRoute(
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GroupsSection />
      </GestureHandlerRootView>
    );

    const [headerButton] = await screen.findAllByRole('button', { name: 'Crear grupo' });
    await fireEvent.press(headerButton);

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(to));
    expect(router.push).not.toHaveBeenCalledWith(never);
  });
});
