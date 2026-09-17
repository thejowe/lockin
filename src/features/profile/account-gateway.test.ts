/**
 * Tests del puente con la capa de cuentas.
 *
 * Solo tiene una decisión propia, y es la que evita que la tab Perfil reviente
 * en desarrollo: sin credenciales de Supabase la app corre contra el mock en
 * memoria, donde `getSupabaseClient()` lanza y no hay ninguna cuenta que
 * asegurar. Ahí `readAccountState()` devuelve `null` —que la sección lee como
 * «aquí no hay capa de cuentas»— en vez de preguntar y explotar.
 *
 * `hasSupabaseCredentials` se calcula una sola vez al cargar `./client`, así
 * que las credenciales se ponen ANTES de cargar el puente y con `require`, no
 * con `import`, para que la carga no se hoistee por encima de la asignación.
 * Es el mismo patrón que `src/data/supabase/client.test.ts`.
 *
 * El resto del módulo son reexportaciones: lo que hacen se prueba en
 * `src/data/supabase/auth.test.ts`.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

import type { AccountState } from './account-gateway';

const mockGetAccountState = jest.fn();

jest.mock('@/data/supabase', () => ({
  ...jest.requireActual('@/data/supabase'),
  getAccountState: () => mockGetAccountState(),
}));

const ASEGURADA: AccountState = {
  kind: 'email',
  userId: 'uid-1',
  email: 'ana@example.com',
  pendingEmail: null,
  recoverable: true,
};

/** Carga el puente con el entorno que tendría la app en cada caso. */
function load(withCredentials: boolean): typeof import('./account-gateway') {
  jest.resetModules();

  if (withCredentials) {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://ref.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  } else {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  }

  return require('./account-gateway') as typeof import('./account-gateway');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAccountState.mockResolvedValue(ASEGURADA);
});

describe('readAccountState', () => {
  it('con credenciales, pregunta a la capa de datos', async () => {
    const { readAccountState } = load(true);

    await expect(readAccountState()).resolves.toEqual(ASEGURADA);
    expect(mockGetAccountState).toHaveBeenCalled();
  });

  it('sin credenciales no pregunta nada: no hay cuenta que asegurar', async () => {
    const { readAccountState } = load(false);

    await expect(readAccountState()).resolves.toBeNull();
    expect(mockGetAccountState).not.toHaveBeenCalled();
  });
});
