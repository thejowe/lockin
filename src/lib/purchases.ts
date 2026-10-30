/**
 * Compras de Premium.
 *
 * Fase 3 de la spec (`react-native-purchases` + RevenueCat) está bloqueada por
 * las cuentas de las tiendas, así que de momento este módulo es la costura:
 *
 * - Con el backend mock (sin credenciales de Supabase), las ofertas son FALSAS
 *   y `purchase` enciende Premium en el mock. Sirve para recorrer el paywall.
 * - Con Supabase y sin SDK, `getOfferings` lanza `PurchasesUnavailableError` y
 *   el paywall dice que las compras aún no están disponibles. Nunca se
 *   vende nada que no se pueda cobrar.
 *
 * Los precios de la pantalla salen siempre de aquí (`priceString`); el paywall
 * no escribe ninguno a mano. Cuando llegue el SDK solo cambian estas funciones.
 */

import { Platform } from 'react-native';

import { setMockPremium } from '@/data/mock';
import { hasSupabaseCredentials } from '@/data/supabase/client';

export interface PurchasePackage {
  id: string;
  period: 'month' | 'year';
  /** El precio tal y como lo da la tienda, ya con moneda. */
  priceString: string;
  /** El equivalente mensual, para comparar el plan anual con el mensual. */
  pricePerMonthString: string;
}

export type PurchaseResult = 'purchased' | 'cancelled' | 'pending';

/** No hay tienda conectada: las compras aún no existen en esta build. */
export class PurchasesUnavailableError extends Error {
  override name = 'PurchasesUnavailableError';

  constructor() {
    super('Las compras aún no están disponibles.');
  }
}

/** Ofertas de mentira del mock. Los precios son los que propone la spec, no definitivos. */
const FAKE_OFFERINGS: PurchasePackage[] = [
  {
    id: 'mock_month',
    period: 'month',
    priceString: '9,99 €',
    pricePerMonthString: '9,99 €',
  },
  {
    id: 'mock_year',
    period: 'year',
    priceString: '49,99 €',
    pricePerMonthString: '4,17 €',
  },
];

function usesMockStore(): boolean {
  return !hasSupabaseCredentials;
}

export async function getOfferings(): Promise<PurchasePackage[]> {
  if (usesMockStore()) return FAKE_OFFERINGS.map((offer) => ({ ...offer }));
  throw new PurchasesUnavailableError();
}

export async function purchase(id: string): Promise<PurchaseResult> {
  if (usesMockStore()) {
    if (!FAKE_OFFERINGS.some((offer) => offer.id === id)) {
      throw new Error(`Oferta desconocida: ${id}`);
    }
    setMockPremium(true);
    return 'purchased';
  }
  throw new PurchasesUnavailableError();
}

export async function restore(): Promise<void> {
  if (usesMockStore()) return;
  throw new PurchasesUnavailableError();
}

/** Dónde se cancela o gestiona la suscripción: la tienda, no cofounder. */
export function manageSubscriptionsUrl(): string {
  return Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';
}
