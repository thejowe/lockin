/**
 * Punto único de acceso a datos de LockIn.
 *
 * Las pantallas importan siempre desde `@/data` — nunca desde `@/data/mock`
 * ni desde `@/data/supabase`. Así el backend se puede sustituir sin tocarlas.
 *
 * Dentro de un componente, usa `useRepositories()`; fuera de React, la
 * constante `repositories`.
 */

export { presence, repositories, videoSignal } from './active';
export * from './types';
export * from './repositories';
export { DataProvider, useRepositories, useQuery } from './provider';
export type { QueryState } from './provider';
export * from './sessions';
export * from './streaks';
export * from './session-errors';
export * from './agreement';
export { createMemoryPresenceAdapter } from './presence';
export type { PresenceAdapter, PresenceHandlers } from './presence';
export { createMemoryVideoSignalAdapter } from './video-signal';
export type {
  VideoSignalChannel,
  VideoSignalHandlers,
  VideoSignalKind,
  VideoSignalMessage,
} from './video-signal';
