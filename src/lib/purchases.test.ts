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

describe('purchases con Supabase y SDK de RevenueCat', () => {
  const sdk = {
    configure: jest.fn(),
    logIn: jest.fn().mockResolvedValue({}),
    logOut: jest.fn().mockResolvedValue({}),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn().mockResolvedValue({}),
    checkTrialOrIntroductoryPriceEligibility: jest.fn(),
    PURCHASES_ERROR_CODE: { PAYMENT_PENDING_ERROR: '20' },
    INTRO_ELIGIBILITY_STATUS: {
      INTRO_ELIGIBILITY_STATUS_UNKNOWN: 0,
      INTRO_ELIGIBILITY_STATUS_ELIGIBLE: 2,
    },
  };
  const pkg = (
    identifier: string,
    packageType: string,
    price: string,
    perMonth: string | null,
    introPrice: Record<string, unknown> | null = null
  ) => ({
    identifier,
    packageType,
    product: {
      identifier: `prod${identifier}`,
      priceString: price,
      pricePerMonthString: perMonth,
      introPrice,
    },
  });
  const threeDaysFree = {
    price: 0,
    priceString: '0,00 €',
    cycles: 1,
    period: 'P3D',
    periodUnit: 'DAY',
    periodNumberOfUnits: 3,
  };
  let fresh: typeof import('./purchases');
  let profileRow: { id: string } | null = { id: 'u1' };

  beforeEach(() => {
    profileRow = { id: 'u1' };
    jest.resetModules();
    Object.values(sdk).forEach(
      (fn) => typeof fn === 'function' && 'mockClear' in fn && fn.mockClear()
    );
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = 'goog_test';
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'appl_test';
    sdk.getOfferings.mockResolvedValue({
      current: {
        availablePackages: [
          pkg('$rc_annual', 'ANNUAL', '39,99 €', '3,33 €'),
          pkg('$rc_weekly', 'WEEKLY', '1,99 €', null),
          pkg('$rc_monthly', 'MONTHLY', '4,99 €', null),
        ],
      },
    });
    jest.doMock('@/data/supabase/client', () => ({
      hasSupabaseCredentials: true,
      getSupabaseClient: () => ({
        auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
        from: () => ({
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: profileRow, error: null }) }),
          }),
        }),
      }),
    }));
    jest.doMock('react-native-purchases', () => ({ __esModule: true, default: sdk }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    fresh = require('./purchases');
  });

  afterEach(() => {
    jest.dontMock('@/data/supabase/client');
    jest.dontMock('react-native-purchases');
    delete process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  });

  it('inicia sesión con el uid de Supabase y ofrece mensual y anual con los precios de la tienda', async () => {
    const offers = await fresh.getOfferings();

    expect(sdk.logIn).toHaveBeenCalledWith('u1');
    expect(offers).toEqual([
      {
        id: '$rc_monthly',
        period: 'month',
        priceString: '4,99 €',
        pricePerMonthString: '4,99 €',
        freeTrial: null,
      },
      {
        id: '$rc_annual',
        period: 'year',
        priceString: '39,99 €',
        pricePerMonthString: '3,33 €',
        freeTrial: null,
      },
    ]);
    // Sin precio introductorio no hace falta preguntar a la tienda.
    expect(sdk.checkTrialOrIntroductoryPriceEligibility).not.toHaveBeenCalled();
  });

  describe('prueba gratis en iOS', () => {
    beforeEach(() => {
      sdk.getOfferings.mockResolvedValue({
        current: {
          availablePackages: [
            pkg('$rc_monthly', 'MONTHLY', '4,99 €', null, threeDaysFree),
            pkg('$rc_annual', 'ANNUAL', '39,99 €', '3,33 €', threeDaysFree),
          ],
        },
      });
    });

    it('solo se anuncia en los productos que la tienda dice ELIGIBLE', async () => {
      sdk.checkTrialOrIntroductoryPriceEligibility.mockResolvedValueOnce({
        prod$rc_monthly: { status: 2 },
        prod$rc_annual: { status: 0 },
      });

      const offers = await fresh.getOfferings();

      expect(sdk.checkTrialOrIntroductoryPriceEligibility).toHaveBeenCalledWith([
        'prod$rc_monthly',
        'prod$rc_annual',
      ]);
      expect(offers.map((offer) => offer.freeTrial)).toEqual([{ count: 3, unit: 'day' }, null]);
    });

    it('si la consulta de derecho falla, no se promete ninguna', async () => {
      sdk.checkTrialOrIntroductoryPriceEligibility.mockRejectedValueOnce(new Error('red'));

      const offers = await fresh.getOfferings();

      expect(offers.map((offer) => offer.freeTrial)).toEqual([null, null]);
    });
  });

  it('no repite logIn para el mismo uid y lo repite tras logOut', async () => {
    await fresh.getOfferings();
    await fresh.restore();
    expect(sdk.logIn).toHaveBeenCalledTimes(1);

    await fresh.logOutPurchases();
    expect(sdk.logOut).toHaveBeenCalled();
    await fresh.restore();
    expect(sdk.logIn).toHaveBeenCalledTimes(2);
  });

  it('compra, cancelación y pago pendiente', async () => {
    await fresh.getOfferings();
    sdk.purchasePackage.mockResolvedValueOnce({});
    expect(await fresh.purchase('$rc_monthly')).toBe('purchased');
    sdk.purchasePackage.mockRejectedValueOnce({ userCancelled: true });
    expect(await fresh.purchase('$rc_monthly')).toBe('cancelled');
    sdk.purchasePackage.mockRejectedValueOnce({ userCancelled: false, code: '20' });
    expect(await fresh.purchase('$rc_monthly')).toBe('pending');
    sdk.purchasePackage.mockRejectedValueOnce(new Error('boom'));
    await expect(fresh.purchase('$rc_monthly')).rejects.toThrow('boom');
    await expect(fresh.purchase('$rc_nope')).rejects.toThrow('Oferta desconocida');
  });

  it('sin perfil creado no se ofrece ni se vende nada', async () => {
    profileRow = null;
    await expect(fresh.getOfferings()).rejects.toBeInstanceOf(fresh.PurchasesUnavailableError);
    await expect(fresh.purchase('$rc_monthly')).rejects.toBeInstanceOf(
      fresh.PurchasesUnavailableError
    );
    expect(sdk.logIn).not.toHaveBeenCalled();
  });

  it('sin ofertas utilizables no hay paywall', async () => {
    sdk.getOfferings.mockResolvedValueOnce({ current: null });
    await expect(fresh.getOfferings()).rejects.toBeInstanceOf(fresh.PurchasesUnavailableError);
  });

  it('sin clave de la plataforma las compras no existen', async () => {
    delete process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    await expect(fresh.getOfferings()).rejects.toBeInstanceOf(fresh.PurchasesUnavailableError);
    expect(sdk.configure).not.toHaveBeenCalled();
  });
});

describe('freeTrialOf', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { freeTrialOf } = require('./purchases') as typeof import('./purchases');
  type Product = Parameters<typeof freeTrialOf>[0];
  const product = (fields: Record<string, unknown>) => fields as unknown as Product;
  const intro = (fields: Record<string, unknown>) => ({
    price: 0,
    priceString: '0,00 €',
    cycles: 1,
    period: 'P3D',
    periodUnit: 'DAY',
    periodNumberOfUnits: 3,
    ...fields,
  });

  it('iOS: prueba gratis solo con derecho confirmado', () => {
    const p = product({ introPrice: intro({}) });
    expect(freeTrialOf(p, 'ios', true)).toEqual({ count: 3, unit: 'day' });
    expect(freeTrialOf(p, 'ios', false)).toBeNull();
  });

  it('iOS: un precio introductorio de pago no es una prueba gratis', () => {
    const p = product({ introPrice: intro({ price: 0.99, priceString: '0,99 €' }) });
    expect(freeTrialOf(p, 'ios', true)).toBeNull();
  });

  it('iOS: sin oferta introductoria o con unidad desconocida, nada', () => {
    expect(freeTrialOf(product({ introPrice: null }), 'ios', true)).toBeNull();
    expect(
      freeTrialOf(product({ introPrice: intro({ periodUnit: 'UNKNOWN' }) }), 'ios', true)
    ).toBeNull();
  });

  it('iOS: varios ciclos de una semana suman semanas', () => {
    const p = product({
      introPrice: intro({ cycles: 2, period: 'P1W', periodUnit: 'WEEK', periodNumberOfUnits: 1 }),
    });
    expect(freeTrialOf(p, 'ios', true)).toEqual({ count: 2, unit: 'week' });
  });

  it('Android: la fase gratuita de la opción que se compra', () => {
    const p = product({
      introPrice: null,
      defaultOption: {
        freePhase: {
          billingPeriod: { unit: 'DAY', value: 3, iso8601: 'P3D' },
          billingCycleCount: 1,
        },
      },
    });
    // En Android el derecho ya lo filtra Play: no depende de la consulta de iOS.
    expect(freeTrialOf(p, 'android', false)).toEqual({ count: 3, unit: 'day' });
  });

  it('Android: con una fase de pago rebajada tras la prueba, no se anuncia', () => {
    const p = product({
      defaultOption: {
        freePhase: {
          billingPeriod: { unit: 'DAY', value: 3, iso8601: 'P3D' },
          billingCycleCount: 1,
        },
        introPhase: {
          billingPeriod: { unit: 'MONTH', value: 1, iso8601: 'P1M' },
          billingCycleCount: 1,
        },
      },
    });
    expect(freeTrialOf(p, 'android', false)).toBeNull();
  });

  it('Android: sin fase gratuita, nada', () => {
    expect(
      freeTrialOf(product({ defaultOption: { freePhase: null } }), 'android', false)
    ).toBeNull();
    expect(freeTrialOf(product({ defaultOption: null }), 'android', false)).toBeNull();
  });
});
