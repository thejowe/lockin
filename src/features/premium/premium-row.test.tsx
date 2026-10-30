/**
 * La fila de Premium en Cuenta: hasta cuándo, gestionar en la tienda u ofrecerlo.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { DataProvider } from '@/data';
import { createMockRepositories, resetState, setMockPremium } from '@/data/mock';

import { openPaywall } from './open-paywall';
import { PremiumRow } from './premium-row';

import type { PremiumQuotas } from '@/data';

jest.mock('./open-paywall', () => ({ openPaywall: jest.fn() }));

const BASE: PremiumQuotas = {
  isPremium: false,
  premiumUntil: null,
  likesLeft: 25,
  likesResetAt: null,
  supersLeft: 1,
  supersResetAt: null,
  boostAvailableAt: null,
  boostActiveUntil: null,
};

describe('PremiumRow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sin cupos conocidos no pinta nada', async () => {
    await render(<PremiumRow quotas={null} />);

    expect(screen.queryByText('Hazte Premium')).toBeNull();
    expect(screen.queryByText(/Activo hasta/)).toBeNull();
  });

  it('sin Premium ofrece hacerse Premium', async () => {
    await render(<PremiumRow quotas={BASE} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Hazte Premium' }));

    expect(openPaywall).toHaveBeenCalledTimes(1);
  });

  it('con Premium dice hasta cuándo y manda a la tienda', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue();
    await render(
      <PremiumRow quotas={{ ...BASE, isPremium: true, premiumUntil: '2026-11-26T12:00:00Z' }} />
    );

    expect(screen.getByText('Activo hasta 26 nov 2026')).toBeTruthy();
    expect(screen.queryByText('Hazte Premium')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Gestionar suscripción' }));

    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\//));
  });

  describe('Restaurar compras', () => {
    function row(quotas: PremiumQuotas | null, onRestored?: () => void) {
      resetState();
      return render(
        <DataProvider value={createMockRepositories()}>
          <PremiumRow quotas={quotas} onRestored={onRestored} />
        </DataProvider>
      );
    }

    it('está siempre: con Premium, sin él y con los cupos aún sin conocer', async () => {
      const { unmount } = await row(BASE);
      expect(screen.getByRole('button', { name: 'Restaurar compras' })).toBeTruthy();
      await unmount();

      const second = await row({ ...BASE, isPremium: true });
      expect(screen.getByRole('button', { name: 'Restaurar compras' })).toBeTruthy();
      await second.unmount();

      await row(null);
      expect(screen.getByRole('button', { name: 'Restaurar compras' })).toBeTruthy();
    });

    it('sin suscripción que recuperar lo dice', async () => {
      const onRestored = jest.fn();
      await row(BASE, onRestored);

      await fireEvent.press(screen.getByRole('button', { name: 'Restaurar compras' }));

      expect(
        await screen.findByText('No hemos encontrado ninguna suscripción activa.')
      ).toBeTruthy();
      expect(onRestored).toHaveBeenCalledTimes(1);
    });

    it('con suscripción en el servidor avisa para releer los cupos y no dice que falta', async () => {
      const onRestored = jest.fn();
      await row(BASE, onRestored);
      setMockPremium(true);

      await fireEvent.press(screen.getByRole('button', { name: 'Restaurar compras' }));

      await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(1));
      expect(screen.queryByText(/No hemos encontrado/)).toBeNull();
    });
  });
});
