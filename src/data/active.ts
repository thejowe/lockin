/**
 * Elección del backend activo. Es el ÚNICO archivo que decide qué
 * implementación de `Repositories` usa la app.
 *
 * La regla es la presencia de credenciales: si `.env.local` define
 * `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`, la app habla con
 * Supabase; si no, sigue con el mock en memoria. Así el proyecto arranca sin
 * configurar nada y conectarlo es copiar `.env.example` a `.env.local`, sin
 * tocar ninguna pantalla.
 *
 * `createSupabaseRepositories()` no abre ninguna conexión al llamarse: el
 * cliente y la sesión se crean en la primera consulta real.
 */

import { createMockRepositories } from './mock';
import { createSupabaseRepositories } from './supabase';
import { hasSupabaseCredentials } from './supabase/client';

import type { Repositories } from './repositories';

/** La implementación activa: Supabase si hay credenciales, mock si no. */
export const repositories: Repositories = hasSupabaseCredentials
  ? createSupabaseRepositories()
  : createMockRepositories();
