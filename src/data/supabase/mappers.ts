/**
 * Traducción entre filas de Postgres y los tipos de dominio de `src/data/types.ts`.
 *
 * Está aislada del resto a propósito: es lo único que sabe que `availability`
 * vive en dos columnas o que el par de un match va ordenado alfabéticamente.
 * Si el esquema cambia, este archivo absorbe el golpe y `index.ts` no se entera.
 */

import type { MatchRow, MessageRow, ProfileInsert, ProfileRow } from './database.types';
import type { Match, Message, Profile, ProfileInput, ProfileLinks } from '../types';

/**
 * Iniciales a partir del nombre: "Núria Bosch" -> "NB".
 *
 * Copia deliberada de `initialsFrom` en `src/data/mock/store.ts`. Es lógica de
 * dominio que necesitan los dos backends, pero vive en el mock y moverla a un
 * módulo común significaría tocar archivos del bloque `arquitecto`. Cuando
 * alguien la suba a `src/data/`, borra esta copia — si divergen, el avatar de
 * un mismo perfil cambiaría al conectar Supabase.
 */
export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const letters = parts.length === 1 ? [parts[0][0]] : [parts[0][0], parts[parts.length - 1][0]];
  return letters.join('').toUpperCase();
}

/** Columnas `link_*` -> `ProfileLinks`, sin claves para los enlaces ausentes. */
function toLinks(row: ProfileRow): ProfileLinks {
  const links: ProfileLinks = {};
  if (row.link_github) links.github = row.link_github;
  if (row.link_portfolio) links.portfolio = row.link_portfolio;
  if (row.link_linkedin) links.linkedin = row.link_linkedin;
  return links;
}

export function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    location: row.location,
    timezone: row.timezone,
    avatar: { initials: row.avatar_initials, accent: row.avatar_accent },
    specialties: row.specialties,
    lookingFor: row.looking_for,
    startingPoint: row.starting_point,
    availability: {
      hoursPerWeek: row.availability_hours_per_week,
      bands: row.availability_bands,
    },
    ambition: row.ambition,
    links: toLinks(row),
    prompts: row.prompts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * `ProfileInput` -> fila lista para `upsert`.
 *
 * `id` lo pone quien llama (es `auth.uid()`, nunca un valor del formulario) y
 * `created_at`/`updated_at` los pone la base: `created_at` con su `default` en
 * el insert, `updated_at` con el trigger `profiles_touch_updated_at`. Así
 * "conserva createdAt al editar y mueve updatedAt" no depende del cliente.
 *
 * @param existing Perfil actual, si lo hay. Solo se usa para heredar el acento
 *   del avatar cuando el formulario no manda uno — igual que hace el mock.
 */
export function toProfileInsert(
  id: string,
  input: ProfileInput,
  existing: Profile | null
): ProfileInsert {
  return {
    id,
    name: input.name,
    age: input.age,
    location: input.location,
    timezone: input.timezone,
    avatar_initials: input.avatar?.initials ?? initialsFrom(input.name),
    avatar_accent: input.avatar?.accent ?? existing?.avatar.accent ?? 'brass',
    specialties: input.specialties,
    looking_for: input.lookingFor,
    starting_point: input.startingPoint,
    availability_hours_per_week: input.availability.hoursPerWeek,
    availability_bands: input.availability.bands,
    ambition: input.ambition,
    link_github: input.links.github ?? null,
    link_portfolio: input.links.portfolio ?? null,
    link_linkedin: input.links.linkedin ?? null,
    prompts: input.prompts,
  };
}

/**
 * Fila de `matches` -> `Match`.
 *
 * En la base el par va ordenado (`profile_a < profile_b`) para que UNIQUE
 * impida duplicados; el contrato, en cambio, promete `[propio, otro]`. Esa
 * reconstrucción es exactamente lo que hace esta función.
 */
export function toMatch(row: MatchRow, currentUserId: string): Match {
  const counterpartId = row.profile_a === currentUserId ? row.profile_b : row.profile_a;

  return {
    id: row.id,
    profileIds: [currentUserId, counterpartId],
    mode: row.mode,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
  };
}

/** El id del otro lado del match. */
export function counterpartIdOf(row: MatchRow, currentUserId: string): string {
  return row.profile_a === currentUserId ? row.profile_b : row.profile_a;
}

export function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    matchId: row.match_id,
    senderId: row.sender_id,
    body: row.body,
    sentAt: row.sent_at,
  };
}

/**
 * Criterio de orden de `MatchRepository.list()`: actividad reciente primero,
 * usando `createdAt` mientras no haya mensajes. Mismo criterio que el mock.
 */
export function byRecentActivity(
  a: { lastMessageAt: string | null; createdAt: string },
  b: { lastMessageAt: string | null; createdAt: string }
): number {
  return (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt);
}
