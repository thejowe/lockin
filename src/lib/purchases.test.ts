/**
 * Compras: con el mock hay ofertas falsas y `purchase` enciende Premium; con
 * Supabase y sin SDK nada se puede comprar.
 */

import { createMockRepositories, resetState } from '@/data/mock';

import { getOfferings, manageSubscriptionsUrl, purchase, restore } from './purchases';

jest.mock('@/data/supabase/client', () => ({ hasSupabaseCredentials: false }));

beforeEach(() => resetState());

describe('purchases con el mock', () => {
  it('ofrece un plan mensual y uno anual', async () => {
    const offers = await getOfferings();

    expect(offers.map((offer) => offer.period)).toEqual(['month', 'year']);
    offers.forEach((offer) => {
      expect(offer.priceString).toBeTruthy();
      expect(offer.pricePerMonthString).toBeTruthy();
    });
  });

  it('comprar enciende Premium', async () => {
    const premium = createMockRepositories().premium;
    expect((await premium.getQuotas()).isPremium).toBe(false);

    expect(await purchase('mock_year')).toBe('purchased');

    expect((await premium.getQuotas()).isPremium).toBe(true);
  });

  it('una oferta desconocida falla y no enciende nada', async () => {
    await expect(purchase('nope')).rejects.toThrow();
    expect((await createMockRepositories().premium.getQuotas()).isPremium).toBe(false);
  });

  it('restaurar no falla', async () => {
    await expect(restore()).resolves.toBeUndefined();
  });

  it('la gestión apunta a una tienda', () => {
    expect(manageSubscriptionsUrl()).toMatch(/^https:\/\/(apps\.apple|play\.google)\.com\//);
  });
});

describe('purchases con Supabase y sin SDK', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('@/data/supabase/client', () => ({ hasSupabaseCredentials: true }));
  });

  afterEach(() => jest.dontMock('@/data/supabase/client'));

  it('no hay nada que comprar ni restaurar', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fresh = require('./purchases') as typeof import('./purchases');

    await expect(fresh.getOfferings()).rejects.toBeInstanceOf(fresh.PurchasesUnavailableError);
    await expect(fresh.purchase('mock_month')).rejects.toBeInstanceOf(
      fresh.PurchasesUnavailableError
    );
    await expect(fresh.restore()).rejects.toBeInstanceOf(fresh.PurchasesUnavailableError);
  });
});
