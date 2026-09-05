/**
 * Punto único de acceso a datos de LockIn.
 *
 * Las pantallas importan siempre desde `@/data` — nunca desde `@/data/mock`
 * ni desde `@/data/supabase`. Así el backend se puede sustituir sin tocarlas.
 *
 * Dentro de un componente, usa `useRepositories()`; fuera de React, la
 * constante `repositories`.
 */

export { repositories } from './active';
export * from './types';
export * from './repositories';
export { DataProvider, useRepositories, useQuery } from './provider';
export type { QueryState } from './provider';
