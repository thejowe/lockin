/**
 * Reglas de los grupos.
 *
 * Una sola fuente para el mock, el repositorio de Supabase y la UI. El SQL de
 * `supabase/migrations/20261109130000_groups.sql` repite estas mismas reglas en
 * sus funciones: si cambia una, cambian las dos.
 */

import type { GroupInput, GroupRole, GroupUpdateInput, Specialty } from './types';

/**
 * ¿Crear un grupo exige Premium? Hoy es gratis. Para cobrarlo: `true` aquí (la
 * app abre el paywall antes de enseñar el formulario) y `true` en
 * `public.group_creation_requires_premium()` (el servidor lo rechaza con LQ005).
 */
export const GROUP_CREATION_REQUIRES_PREMIUM = false;

/** Miembros como mucho, contando a quien lo crea. */
export const GROUP_MAX_MEMBERS = 6;
/** Plazas como mucho entre todos los puestos: el admin ocupa un sitio aparte. */
export const GROUP_MAX_ROLE_SLOTS = GROUP_MAX_MEMBERS - 1;

export const GROUP_NAME_MIN = 2;
export const GROUP_NAME_MAX = 60;
export const GROUP_DESCRIPTION_MIN = 10;
export const GROUP_DESCRIPTION_MAX = 500;

/**
 * Por qué no se pudo:
 * - `invalid`: nombre, descripción o puestos no válidos (LG001).
 * - `already-in-group`: ya estás en un grupo (LG002).
 * - `unavailable`: el grupo no existe, ya no está o no estás en él (LG003).
 * - `admin-only`: solo lo puede hacer quien administra el grupo (LG004).
 * - `candidate-unavailable`: esa persona ya no está disponible (LG005).
 */
export type GroupErrorReason =
  'invalid' | 'already-in-group' | 'unavailable' | 'admin-only' | 'candidate-unavailable';

export class GroupError extends Error {
  override name = 'GroupError';
  readonly reason: GroupErrorReason;

  constructor(reason: GroupErrorReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

/** Código de Postgres de cada motivo. Lo usan los dos backends y sus tests. */
export const GROUP_ERROR_CODES: Record<string, GroupErrorReason> = {
  LG001: 'invalid',
  LG002: 'already-in-group',
  LG003: 'unavailable',
  LG004: 'admin-only',
  LG005: 'candidate-unavailable',
};

/** Plazas libres de un puesto. */
export function openSlots(role: Pick<GroupRole, 'slots' | 'filled'>): number {
  return Math.max(role.slots - role.filled, 0);
}

/**
 * El primer puesto abierto que encaja con lo que domina la persona, en el orden
 * en que llegan los puestos (los dos backends los entregan ya ordenados).
 */
export function firstOpenRoleFor<T extends Pick<GroupRole, 'specialty' | 'slots' | 'filled'>>(
  roles: readonly T[],
  specialties: readonly Specialty[]
): T | null {
  return roles.find((role) => openSlots(role) > 0 && specialties.includes(role.specialty)) ?? null;
}

/**
 * `null` si el grupo se puede dejar así; si no, el error que lanzar. Además de
 * las reglas de crear: no se quita un perfil que alguien ocupa ni se le dejan
 * menos plazas que personas dentro (para eso está expulsar).
 */
export function validateGroupUpdate(
  input: GroupUpdateInput,
  current: {
    maxMembers: number;
    roles: readonly Pick<GroupRole, 'specialty' | 'filled'>[];
  }
): GroupError | null {
  const invalid = validateGroupInput({ ...input, maxMembers: current.maxMembers });
  if (invalid) return invalid;
  const wanted = new Map(input.roles.map((role) => [role.specialty, role.slots]));
  if (current.roles.some((role) => role.filled > (wanted.get(role.specialty) ?? 0))) {
    return new GroupError('invalid', 'Hay personas en ese perfil.');
  }
  return null;
}

/** `null` si el grupo se puede crear; si no, el error que lanzar. */
export function validateGroupInput(input: GroupInput): GroupError | null {
  const name = input.name.trim();
  const description = input.description.trim();
  const maxMembers = input.maxMembers ?? GROUP_MAX_MEMBERS;

  if (Array.from(name).length < GROUP_NAME_MIN || Array.from(name).length > GROUP_NAME_MAX) {
    return new GroupError('invalid', 'El nombre necesita entre 2 y 60 caracteres.');
  }
  if (
    Array.from(description).length < GROUP_DESCRIPTION_MIN ||
    Array.from(description).length > GROUP_DESCRIPTION_MAX
  ) {
    return new GroupError('invalid', 'La descripción necesita entre 10 y 500 caracteres.');
  }
  if (!Number.isInteger(maxMembers) || maxMembers < 2 || maxMembers > GROUP_MAX_MEMBERS) {
    return new GroupError('invalid', 'Un grupo tiene entre 2 y 6 miembros.');
  }
  if (input.roles.length < 1 || input.roles.length > GROUP_MAX_ROLE_SLOTS) {
    return new GroupError('invalid', 'Elige al menos un perfil.');
  }
  if (new Set(input.roles.map((role) => role.specialty)).size !== input.roles.length) {
    return new GroupError('invalid', 'Hay un puesto repetido.');
  }
  if (input.roles.some((role) => !Number.isInteger(role.slots) || role.slots < 1)) {
    return new GroupError('invalid', 'Cada puesto necesita al menos una plaza.');
  }
  const total = input.roles.reduce((sum, role) => sum + role.slots, 0);
  if (total + 1 > maxMembers) {
    return new GroupError('invalid', 'Hay más plazas que sitio en el grupo.');
  }
  return null;
}
