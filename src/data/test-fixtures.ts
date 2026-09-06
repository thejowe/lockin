/**
 * Fábricas de datos para los tests.
 *
 * Existen para que un test hable solo de lo que le importa: `buildProfile({
 * lookingFor: 'lockin' })` deja claro que el resto de campos son relleno. Si
 * `Profile` gana un campo obligatorio, se añade aquí una vez y no en cada test.
 *
 * No lo importes desde código de producción.
 */

import type { Profile, ProfileInput } from './types';

const BASE_PROFILE: Profile = {
  id: 'test-profile',
  name: 'Perfil Prueba',
  age: 30,
  location: 'Barcelona',
  timezone: 'Europe/Madrid',
  avatar: { initials: 'PP', accent: 'brass' },
  specialties: ['producto'],
  lookingFor: 'ambos',
  startingPoint: 'idea-sin-empezar',
  availability: { hoursPerWeek: 12, bands: ['noche'] },
  ambition: 'equilibrado',
  links: {},
  prompts: [{ question: 'Lo que quiero construir es…', answer: 'Algo pequeño y rentable.' }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

/** Un `Profile` completo con los campos que le pases sobrescritos. */
export function buildProfile(overrides: Partial<Profile> = {}): Profile {
  return { ...BASE_PROFILE, ...overrides };
}

/** Lo mismo, con la forma que envía el formulario (sin id ni timestamps). */
export function buildProfileInput(overrides: Partial<ProfileInput> = {}): ProfileInput {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = BASE_PROFILE;
  return { ...input, ...overrides };
}
