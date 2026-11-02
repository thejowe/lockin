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
import { getSupabaseClient, hasSupabaseCredentials } from '@/data/supabase/client';

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

/** Ofertas de mentira del mock. Precios definitivos (2026-11-01): 4,99 €/mes y 39,99 €/año. */
const FAKE_OFFERINGS: PurchasePackage[] = [
  {
    id: 'mock_month',
    period: 'month',
    priceString: '4,99 €',
    pricePerMonthString: '4,99 €',
  },
  {
    id: 'mock_year',
    period: 'year',
    priceString: '39,99 €',
    pricePerMonthString: '3,33 €',
  },
];

function usesMockStore(): boolean {
  return !hasSupabaseCredentials;
}

type PurchasesSdk = typeof import('react-native-purchases').default;
type SdkPackage = import('react-native-purchases').PurchasesPackage;

/**
 * Claves PÚBLICAS del SDK de RevenueCat (`goog_…` / `appl_…`), una por tienda. Se
 * inyectan en el build; sin la de la plataforma, las compras no existen.
 */
function sdkApiKey(): string | null {
  const key =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : Platform.OS === 'android'
        ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
        : undefined;
  return key ? key : null;
}

/** El SDK es nativo: se carga solo cuando hace falta (Jest, web y Expo Go no lo tienen). */
function loadSdk(): PurchasesSdk {
  const apiKey = sdkApiKey();
  if (!apiKey) throw new PurchasesUnavailableError();
  let sdk: PurchasesSdk;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sdk = (require('react-native-purchases') as { default: PurchasesSdk }).default;
  } catch {
    throw new PurchasesUnavailableError();
  }
  if (!configured) {
    sdk.configure({ apiKey });
    configured = true;
  }
  return sdk;
}

let configured = false;
/** Último uid con el que se hizo `logIn`, para no repetirlo en cada llamada. */
let loggedInAs: string | null = null;

/**
 * `app_user_id` de RevenueCat = `auth.uid()` de Supabase, nunca un usuario anónimo
 * de RevenueCat: así una compra no puede quedar sin dueño (spec §4).
 */
async function sdkReady(): Promise<PurchasesSdk> {
  const sdk = loadSdk();
  const client = getSupabaseClient();
  const { data } = await client.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new PurchasesUnavailableError();
  // `entitlements.user_id` referencia `profiles`: sin perfil el servidor no puede activar Premium
  // y se cobraría sin entregar nada. Nunca se vende a quien aún no ha terminado el perfil.
  const { data: profile, error } = await client
    .from('profiles')
    .select('id')
    .eq('id', uid)
    .maybeSingle();
  if (error || !profile) throw new PurchasesUnavailableError();
  if (loggedInAs !== uid) {
    await sdk.logIn(uid);
    loggedInAs = uid;
  }
  return sdk;
}

/** Al cerrar sesión o borrar la cuenta: la siguiente persona no hereda la identidad. */
export async function logOutPurchases(): Promise<void> {
  if (usesMockStore() || !configured) return;
  loggedInAs = null;
  try {
    const sdk = loadSdk();
    await sdk.logOut();
  } catch {
    // Sin sesión de RevenueCat (ya era anónimo) o sin SDK: no hay nada que cerrar.
  }
}

/** Los paquetes del SDK que se pintan, indexados por el id que ve la interfaz. */
const sdkPackages = new Map<string, SdkPackage>();

function periodOf(pkg: SdkPackage): 'month' | 'year' | null {
  if (pkg.packageType === 'MONTHLY') return 'month';
  if (pkg.packageType === 'ANNUAL') return 'year';
  return null;
}

export async function getOfferings(): Promise<PurchasePackage[]> {
  if (usesMockStore()) return FAKE_OFFERINGS.map((offer) => ({ ...offer }));
  const sdk = await sdkReady();
  const offerings = await sdk.getOfferings();
  const available = offerings.current?.availablePackages ?? [];
  sdkPackages.clear();
  const result: PurchasePackage[] = [];
  for (const pkg of available) {
    const period = periodOf(pkg);
    if (!period) continue;
    sdkPackages.set(pkg.identifier, pkg);
    const price = pkg.product.priceString;
    result.push({
      id: pkg.identifier,
      period,
      priceString: price,
      pricePerMonthString: pkg.product.pricePerMonthString ?? price,
    });
  }
  // Nunca se enseña un paywall sin nada que cobrar.
  if (result.length === 0) throw new PurchasesUnavailableError();
  return result.sort((a, b) => (a.period === b.period ? 0 : a.period === 'month' ? -1 : 1));
}

export async function purchase(id: string): Promise<PurchaseResult> {
  if (usesMockStore()) {
    if (!FAKE_OFFERINGS.some((offer) => offer.id === id)) {
      throw new Error(`Oferta desconocida: ${id}`);
    }
    setMockPremium(true);
    return 'purchased';
  }
  const sdk = await sdkReady();
  const pkg = sdkPackages.get(id);
  if (!pkg) throw new Error(`Oferta desconocida: ${id}`);
  try {
    await sdk.purchasePackage(pkg);
    return 'purchased';
  } catch (error) {
    const e = error as { userCancelled?: boolean | null; code?: string };
    if (e.userCancelled) return 'cancelled';
    // PAYMENT_PENDING_ERROR: la tienda aún no ha confirmado el pago (tarjeta en espera, etc.).
    if (e.code === sdk.PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) return 'pending';
    throw error;
  }
}

export async function restore(): Promise<void> {
  if (usesMockStore()) return;
  const sdk = await sdkReady();
  await sdk.restorePurchases();
}

/** Dónde se cancela o gestiona la suscripción: la tienda, no cofounder. */
export function manageSubscriptionsUrl(): string {
  return Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';
}
