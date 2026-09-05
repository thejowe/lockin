/**
 * Elección del backend activo. Es el ÚNICO archivo que decide qué
 * implementación de `Repositories` usa la app.
 *
 * Para conectar Supabase (bloque `datos`):
 *   1. Escribe `createSupabaseRepositories()` en `src/data/supabase/` cumpliendo
 *      `Repositories` de `./repositories`.
 *   2. Cambia la línea de abajo, p. ej.
 *      `process.env.EXPO_PUBLIC_SUPABASE_URL ? createSupabaseRepositories() : createMockRepositories()`.
 *   3. No toques ninguna pantalla.
 */

import { createMockRepositories } from './mock';

import type { Repositories } from './repositories';

/** La implementación activa. Hoy: mock en memoria. */
export const repositories: Repositories = createMockRepositories();
