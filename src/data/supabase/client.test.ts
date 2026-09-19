/**
 * Configuración del cliente de Supabase.
 *
 * `createClient` se mockea entero: estos tests no hablan con ninguna red, solo
 * comprueban con qué opciones se construye el cliente. Las credenciales se
 * ponen ANTES de cargar `./client` (con `require`, no `import`, para que no se
 * hoisteen por encima de esta asignación): el módulo las lee de `process.env`
 * una sola vez al importarse, igual que documenta `contract.test.ts`.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://ref.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

const { getSupabaseClient, resetSupabaseClient } = require('./client') as typeof import('./client');
const { resilientFetch } = require('./resilient-fetch') as typeof import('./resilient-fetch');

describe('getSupabaseClient — configuración', () => {
  afterEach(() => {
    resetSupabaseClient();
  });

  it('guarda la sesión en AsyncStorage y no detecta sesión en la URL: no hay callback OAuth en una URL nativa', () => {
    getSupabaseClient();

    const [, , options] = (createClient as jest.Mock).mock.calls.at(-1);
    expect(options.auth.autoRefreshToken).toBe(true);
    expect(options.auth.persistSession).toBe(true);
    expect(options.auth.detectSessionInUrl).toBe(false);
  });

  it('pasa por el fetch que repite un PGRST303: el bug de reloj de PostgREST no llega a las pantallas', () => {
    getSupabaseClient();

    const [, , options] = (createClient as jest.Mock).mock.calls.at(-1);
    expect(options.global.fetch).toBe(resilientFetch);
  });

  it('usa PKCE: el callback de OAuth trae un code de un solo uso, no un token en la URL', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://ref.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    resetSupabaseClient();

    getSupabaseClient();

    const [, , options] = (createClient as jest.Mock).mock.calls.at(-1);
    expect(options.auth.flowType).toBe('pkce');
  });
});
