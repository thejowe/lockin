import { render, screen } from '@testing-library/react-native';

import { DataProvider } from '@/data';

import { PremiumBadge } from './premium-badge';

import type { Repositories } from '@/data';

function withBadges(ids: string[]) {
  const repositories = {
    premium: { listBadges: jest.fn(async () => ids) },
  } as unknown as Repositories;
  return render(
    <DataProvider value={repositories}>
      <PremiumBadge profileId="p1" />
    </DataProvider>
  );
}

describe('PremiumBadge', () => {
  it('pone el diamante si la persona tiene Premium', async () => {
    await withBadges(['p1']);
    expect(await screen.findByLabelText('Premium')).toBeTruthy();
  });

  it('no pone nada si no lo tiene', async () => {
    await withBadges([]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByLabelText('Premium')).toBeNull();
  });
});
