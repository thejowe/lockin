/**
 * Cliente de Supabase.
 *
 * Se construye una sola vez y solo si hay credenciales. Las lee de las
 * variables `EXPO_PUBLIC_*`, que Expo inlinea en el bundle en tiempo de build:
 * por eso se leen como accesos literales a `process.env.X` y no con una
 * variable intermedia — si no, la sustitución de Metro no ocurre.
 *
 * La clave `anon` es pública por diseño: viaja en el bundle del cliente y la
 * seguridad real la imponen las políticas RLS de `supabase/migrations/`.
 * La `service_role` NUNCA debe aparecer en este archivo ni en ningún otro
 * archivo de la app.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import type { Database } from './database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

export type LockInSupabaseClient = SupabaseClient<Database>;

/**
 * La URL que espera `createClient` es la raíz del proyecto
 * (`https://<ref>.supabase.co`), no el endpoint REST. Como el dashboard de
 * Supabase enseña ambas cosas en pantallas distintas, aceptamos las dos formas
 * y normalizamos: pegar la URL con `/rest/v1/` es el error más fácil de cometer
 * y produce un 404 opaco en la primera consulta.
 */
export function normalizeSupabaseUrl(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/, '');
}

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** `true` cuando hay credenciales suficientes para hablar con Supabase. */
export const hasSupabaseCredentials = Boolean(rawUrl && anonKey);

let client: LockInSupabaseClient | null = null;

/**
 * El cliente compartido. Lanza si no hay credenciales — quien lo llama debe
 * haber comprobado antes `hasSupabaseCredentials` (lo hace `src/data/active.ts`).
 */
export function getSupabaseClient(): LockInSupabaseClient {
  if (client) return client;

  if (!rawUrl || !anonKey) {
    throw new Error(
      'Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Copia .env.example a .env.local y rellena los valores del dashboard de Supabase.'
    );
  }

  client = createClient<Database>(normalizeSupabaseUrl(rawUrl), anonKey, {
    auth: {
      // La sesión sobrevive al reinicio de la app. `AsyncStorage` guarda el
      // refresh token en claro en el almacenamiento privado de la app; para el
      // MVP es el compromiso estándar en React Native. Si el producto llega a
      // manejar datos sensibles, esto debe pasar a `expo-secure-store`
      // (con el troceado que exige su límite de 2048 bytes).
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // No hay callback OAuth en una URL: en nativo no hay nada que detectar.
      detectSessionInUrl: false,
    },
  });

  return client;
}

/** Solo para tests: olvida el cliente memoizado. */
export function resetSupabaseClient(): void {
  client = null;
}
